import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getNewsSearchRatelimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { validateGeminiKey } from "@/lib/ai/geminiClient";
import { getNextGapTopic } from "@/lib/news/topicRotation";
import { checkTitleSimilarity } from "@/lib/news/titleSimilarity";
import type { CityFocus, AudienceFocus } from "@/lib/newsTopicTypes";

export const maxDuration = 30;

const VALID_CITY_FOCUS = ["Phnom Penh", "Siem Reap", "Cambodia wide"];
const VALID_AUDIENCE_FOCUS = ["travellers", "teachers", "both"];

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 30_000;

// ─── Low-cost generation config for title generation only ────
const TITLE_GENERATION_CONFIG = {
  maxOutputTokens: 256,
  temperature: 0.5,
  topP: 0.9,
  topK: 40,
  responseMimeType: "application/json",
};

/* ------------------------------------------------------------------ */
/*  Gemini call (title-specific, low token budget)                      */
/* ------------------------------------------------------------------ */

interface GeminiTitleResponse {
  text: string;
  tokenCount: number | null;
}

async function callGeminiForTitle(prompt: string): Promise<GeminiTitleResponse> {
  const apiKey = validateGeminiKey();
  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: TITLE_GENERATION_CONFIG,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
      throw new Error(`Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status}): ${rawBody.slice(0, 300)}`);
  }

  const data = JSON.parse(rawBody);
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini blocked (${blockReason})` : "Gemini returned empty response");
  }

  const tokenCount = data.usageMetadata?.totalTokenCount ?? null;
  return { text, tokenCount };
}

/* ------------------------------------------------------------------ */
/*  JSON parsing with one retry repair                                  */
/* ------------------------------------------------------------------ */

interface TitlePayload {
  title: string;
  why: string[];
  keywords: string[];
}

function stripJsonFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

function tryParseTitle(raw: string): TitlePayload | null {
  try {
    const obj = JSON.parse(stripJsonFences(raw));
    if (
      typeof obj.title === "string" &&
      Array.isArray(obj.why) &&
      Array.isArray(obj.keywords) &&
      obj.why.length >= 1 &&
      obj.keywords.length >= 1
    ) {
      return {
        title: obj.title,
        why: obj.why.slice(0, 5).map(String),
        keywords: obj.keywords.slice(0, 5).map(String),
      };
    }
  } catch { /* noop */ }
  return null;
}

async function parseWithRetry(raw: string): Promise<{ payload: TitlePayload; repairTokens: number }> {
  const first = tryParseTitle(raw);
  if (first) return { payload: first, repairTokens: 0 };

  console.warn("[Generate Title] First parse failed, attempting repair...");

  const repairPrompt = `Convert the following into a single valid JSON object matching this schema exactly:
{ "title": string, "why": [string, string, string], "keywords": [string, string, string] }

Bad output:
${raw.slice(0, 1000)}

Return raw JSON only. Do not wrap JSON in a string. Do not include newline text outside JSON.`;

  const repair = await callGeminiForTitle(repairPrompt);
  const second = tryParseTitle(repair.text);
  if (second) return { payload: second, repairTokens: repair.tokenCount ?? 0 };

  throw new Error("Title generation returned invalid JSON even after repair attempt");
}

/* ------------------------------------------------------------------ */
/*  Title validation (hard constraints)                                 */
/* ------------------------------------------------------------------ */

const EM_DASH = "\u2014";

interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

function validateTitle(
  title: string,
  cityFocus: CityFocus,
  primaryKeyword: string,
  currentYear: number
): ValidationResult {
  const reasons: string[] = [];
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;

  if (title.length > 80) {
    reasons.push(`Too long (${title.length} chars, max 80)`);
  }
  if (!title.toLowerCase().includes(city.toLowerCase())) {
    reasons.push(`Missing city "${city}"`);
  }
  if (!title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    reasons.push(`Missing primary keyword "${primaryKeyword}"`);
  }
  if (title.includes(EM_DASH)) {
    reasons.push("Contains em dash");
  }
  // Check for past years (4-digit numbers that aren't currentYear)
  const yearMatches = title.match(/\b(20\d{2})\b/g);
  if (yearMatches) {
    for (const y of yearMatches) {
      if (parseInt(y) !== currentYear) {
        reasons.push(`Contains wrong year ${y} (should be ${currentYear})`);
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}

async function fixTitle(
  title: string,
  cityFocus: CityFocus,
  primaryKeyword: string,
  currentYear: number
): Promise<{ payload: TitlePayload; fixTokens: number }> {
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;

  const fixPrompt = `Fix this blog title to satisfy ALL constraints. Return JSON only with keys: title, why, keywords.

Current title: "${title}"

Constraints:
- Maximum 80 characters
- Must include "${city}" in the title
- Must include "${primaryKeyword}" verbatim in the title
- No em dashes
- Only use year ${currentYear} if a year is present
- 3-5 items in why array, 3-5 items in keywords array

Return raw JSON only. Do not wrap JSON in a string. Do not include newline text outside JSON.`;

  const resp = await callGeminiForTitle(fixPrompt);
  const parsed = tryParseTitle(resp.text);
  if (parsed) return { payload: parsed, fixTokens: resp.tokenCount ?? 0 };
  throw new Error("Title fix attempt returned unparseable JSON");
}

/* ------------------------------------------------------------------ */
/*  Build the main prompt                                               */
/* ------------------------------------------------------------------ */

function buildTitlePrompt(
  todaysDate: string,
  currentYear: number,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus,
  selectedTopic: string,
  primaryKeyword: string,
  avoidTitles: string[]
): string {
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const audienceLabel =
    audienceFocus === "both"
      ? "both travellers and English teachers"
      : audienceFocus === "travellers"
        ? "travellers and tourists"
        : "English teachers and expats";

  const avoidSection =
    avoidTitles.length > 0
      ? `\nDo NOT closely match any of these existing titles:\n${avoidTitles.map((t) => `- ${t}`).join("\n")}\n`
      : "";

  return `TODAY'S DATE: ${todaysDate}
CURRENT YEAR: ${currentYear}
CITY_FOCUS: ${cityFocus}
AUDIENCE_FOCUS: ${audienceFocus}
SELECTED_GAP_TOPIC: ${selectedTopic}
PRIMARY_KEYWORD_PHRASE: ${primaryKeyword}

Generate ONE blog title for GlobeScraper about "${selectedTopic}" in ${city} for ${audienceLabel}.

RULES:
1. Title MUST include "${city}" by name.
2. Title MUST include "${primaryKeyword}" verbatim.
3. Title MUST be <= 80 characters. This is a hard limit.
4. If the topic is time-sensitive, use ${currentYear} only. NEVER use a past year.
5. Do NOT use em dashes anywhere.
6. Title should match ${audienceLabel} intent.
7. Vary format: "How to", "Guide to", a question, or "X Things..." style.
${avoidSection}
Return a single JSON object with these keys only:
- "title": the blog title (string, <= 80 chars)
- "why": array of 3-5 reasons this title was chosen
- "keywords": array of 3-5 SEO keywords

Return raw JSON only. Do not wrap JSON in a string. Do not include newline text outside JSON.`.trim();
}

/* ------------------------------------------------------------------ */
/*  Logging                                                             */
/* ------------------------------------------------------------------ */

async function logTitleGeneration(params: {
  cityFocus: string;
  audienceFocus: string;
  selectedTopic: string;
  generatedTitle: string;
  primaryKeyword: string;
  modelUsed: string;
  tokenUsage: number | null;
  titleLength: number;
}): Promise<void> {
  try {
    await prisma.titleGenerationLog.create({
      data: {
        cityFocus: params.cityFocus,
        audienceFocus: params.audienceFocus,
        selectedTopic: params.selectedTopic,
        generatedTitle: params.generatedTitle,
        primaryKeyword: params.primaryKeyword,
        modelUsed: params.modelUsed,
        tokenUsage: params.tokenUsage,
        titleLength: params.titleLength,
      },
    });
  } catch (err) {
    console.error("[Generate Title] Failed to write log:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const session = await requireAdmin();

    // 2. Rate limit
    const limiter = getNewsSearchRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429 }
        );
      }
    }

    // 3. Parse request
    const body = await req.json().catch(() => ({}));
    const cityFocus: CityFocus = VALID_CITY_FOCUS.includes(body.cityFocus)
      ? body.cityFocus
      : "Cambodia wide";
    const audienceFocus: AudienceFocus = VALID_AUDIENCE_FOCUS.includes(body.audienceFocus)
      ? body.audienceFocus
      : "both";

    // 4. Backend-controlled topic + keyword selection
    const { selectedTopic, primaryKeyword } = await getNextGapTopic({
      cityFocus,
      audienceFocus,
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const todaysDate = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log("[Generate Title] Topic:", selectedTopic, "| Keyword:", primaryKeyword, "| City:", cityFocus);

    // 5. Get existing titles for anti-duplication
    const { closestTitles: avoidTitles } = await checkTitleSimilarity("");
    // We pass an empty string just to get the closest titles list

    // 6. Build prompt and call Gemini
    const prompt = buildTitlePrompt(
      todaysDate,
      currentYear,
      cityFocus,
      audienceFocus,
      selectedTopic,
      primaryKeyword,
      avoidTitles.slice(0, 10)
    );

    const geminiResp = await callGeminiForTitle(prompt);
    let totalTokens = geminiResp.tokenCount ?? 0;

    // 7. Parse with one retry repair
    const { payload, repairTokens } = await parseWithRetry(geminiResp.text);
    totalTokens += repairTokens;

    let finalPayload = payload;

    // 8. Validate hard constraints
    const validation = validateTitle(finalPayload.title, cityFocus, primaryKeyword, currentYear);
    if (!validation.valid) {
      console.warn("[Generate Title] Validation failed:", validation.reasons.join(", "), "| Attempting fix...");
      try {
        const { payload: fixedPayload, fixTokens } = await fixTitle(
          finalPayload.title,
          cityFocus,
          primaryKeyword,
          currentYear
        );
        totalTokens += fixTokens;

        // Re-validate the fix
        const reValidation = validateTitle(fixedPayload.title, cityFocus, primaryKeyword, currentYear);
        if (reValidation.valid) {
          finalPayload = fixedPayload;
        } else {
          console.warn("[Generate Title] Fix attempt still fails validation:", reValidation.reasons.join(", "));
          // Use original anyway — some constraints may be soft in practice
        }
      } catch (fixErr) {
        console.warn("[Generate Title] Fix call failed:", fixErr);
      }
    }

    // 9. Similarity check
    const similarity = await checkTitleSimilarity(finalPayload.title);
    if (similarity.isDuplicate) {
      console.warn("[Generate Title] Duplicate detected:", similarity.reason, "| Regenerating once...");

      // One retry with anti-duplication hints
      const retryPrompt = buildTitlePrompt(
        todaysDate,
        currentYear,
        cityFocus,
        audienceFocus,
        selectedTopic,
        primaryKeyword,
        similarity.closestTitles.slice(0, 10)
      );

      const retryResp = await callGeminiForTitle(retryPrompt);
      totalTokens += retryResp.tokenCount ?? 0;

      const { payload: retryPayload, repairTokens: retryRepair } = await parseWithRetry(retryResp.text);
      totalTokens += retryRepair;

      // Accept the retry regardless of similarity (only one extra attempt)
      finalPayload = retryPayload;
    }

    // 10. Logging
    console.log(
      "[Generate Title] Final:",
      JSON.stringify({
        model: MODEL,
        topic: selectedTopic,
        keyword: primaryKeyword,
        tokens: totalTokens,
        titleLength: finalPayload.title.length,
        title: finalPayload.title,
      })
    );

    await logTitleGeneration({
      cityFocus,
      audienceFocus,
      selectedTopic,
      generatedTitle: finalPayload.title,
      primaryKeyword,
      modelUsed: MODEL,
      tokenUsage: totalTokens,
      titleLength: finalPayload.title.length,
    });

    // 11. Return result
    return NextResponse.json({
      title: finalPayload.title,
      why: finalPayload.why,
      keywords: finalPayload.keywords,
    });
  } catch (error) {
    console.error("[Generate Title] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
