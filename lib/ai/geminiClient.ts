/**
 * Gemini API client for the AI Blog Generator.
 * Uses the Gemini REST API directly (no SDK dependency needed).
 */

import { z, type ZodSchema } from "zod";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = 60_000; // 60 seconds per Gemini call

export interface GeminiResponse {
  text: string;
  tokenCount: number | null;
  modelUsed: string;
}

/**
 * Validate that the Gemini API key is configured.
 * Throws a descriptive error if missing.
 */
export function validateGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Gemini API key not configured.");
  }
  return key;
}

/**
 * Call Gemini to generate text from a prompt.
 */
export async function callGemini(prompt: string): Promise<GeminiResponse> {
  const apiKey = validateGeminiKey();

  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
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
      throw new Error(`Gemini API call timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }

  // Always read as text first to avoid JSON.parse crash on non-JSON responses
  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status}): ${rawBody.slice(0, 500)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Gemini returned non-JSON response: ${rawBody.slice(0, 200)}`
    );
  }

  // Extract text from the response
  const candidate = (data.candidates as Array<Record<string, unknown>>)?.[0];
  if (!candidate?.content || !(candidate.content as Record<string, unknown>).parts) {
    // Check for prompt feedback / safety blocks
    const feedback = data.promptFeedback as Record<string, unknown> | undefined;
    const blockReason = feedback?.blockReason as string | undefined;
    if (blockReason) {
      throw new Error(`Gemini blocked the request (${blockReason}). Try rephrasing the topic.`);
    }
    throw new Error("Gemini returned an empty or blocked response.");
  }

  const parts = (candidate.content as Record<string, unknown>).parts as Array<Record<string, unknown>>;
  const text = parts[0]?.text as string | undefined;
  if (!text) {
    throw new Error("Gemini returned an empty or blocked response.");
  }

  // Try to get token usage
  const tokenCount = (data.usageMetadata as Record<string, unknown>)?.totalTokenCount as number ?? null;

  return {
    text,
    tokenCount,
    modelUsed: MODEL,
  };
}

/**
 * Call Gemini expecting a plain-text response (no JSON mode).
 * Used for the humanization pass and other text-only calls.
 */
export async function callGeminiText(prompt: string): Promise<GeminiResponse> {
  const apiKey = validateGeminiKey();

  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  };

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller2.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout2);
    if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
      throw new Error(`Gemini API call timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout2);
  }

  // Always read as text first to avoid JSON.parse crash on non-JSON responses
  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status}): ${rawBody.slice(0, 500)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Gemini returned non-JSON response: ${rawBody.slice(0, 200)}`
    );
  }

  const candidate = (data.candidates as Array<Record<string, unknown>>)?.[0];
  if (!candidate?.content || !(candidate.content as Record<string, unknown>).parts) {
    const feedback = data.promptFeedback as Record<string, unknown> | undefined;
    const blockReason = feedback?.blockReason as string | undefined;
    if (blockReason) {
      throw new Error(`Gemini blocked the request (${blockReason}). Try rephrasing the topic.`);
    }
    throw new Error("Gemini returned an empty or blocked response.");
  }

  const parts = (candidate.content as Record<string, unknown>).parts as Array<Record<string, unknown>>;
  const text = parts[0]?.text as string | undefined;
  if (!text) {
    throw new Error("Gemini returned an empty or blocked response.");
  }

  return {
    text,
    tokenCount: (data.usageMetadata as Record<string, unknown>)?.totalTokenCount as number ?? null,
    modelUsed: MODEL,
  };
}

/**
 * Parse the JSON response from Gemini, handling potential issues.
 * Strips markdown fences, attempts JSON.parse, and tries common fixups.
 */
export function parseGeminiJson(text: string): Record<string, unknown> {
  const cleaned = stripJsonFences(text);

  // Attempt 1: direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to fixups
  }

  // Attempt 2: try to extract a JSON object from the text
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // continue
    }
  }

  // Attempt 3: fix trailing commas and common issues
  try {
    const fixed = cleaned
      .replace(/,\s*([\]}])/g, "$1")          // trailing commas
      .replace(/:\s*'([^']*)'/g, ': "$1"')     // single → double quotes
      .replace(/[\x00-\x1f]/g, " ");           // control chars
    return JSON.parse(fixed);
  } catch {
    // continue
  }

  throw new Error("INVALID_JSON");
}

/**
 * Strip markdown code fences from a string.
 */
function stripJsonFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Call Gemini expecting JSON, validate with a Zod schema, and auto-repair once on failure.
 *
 * 1. Calls Gemini with responseMimeType=application/json
 * 2. Strips markdown fences and parses JSON
 * 3. Validates against the provided Zod schema
 * 4. If parse or validation fails, sends a repair prompt (max 1 retry)
 * 5. Returns the validated data or throws a clear error
 */
export async function callGeminiWithSchema<T>(
  prompt: string,
  schema: ZodSchema<T>,
  schemaDescription?: string
): Promise<{ data: T; tokenCount: number | null; modelUsed: string }> {
  const fullPrompt = `${prompt}\n\nIMPORTANT: Return JSON only. No prose, no commentary, no markdown fences. Output must be a single valid JSON object.`;

  const response = await callGemini(fullPrompt);
  let totalTokens = response.tokenCount ?? 0;

  // Attempt 1: parse and validate
  const firstResult = tryParseAndValidate(response.text, schema);
  if (firstResult.success) {
    return { data: firstResult.data, tokenCount: totalTokens, modelUsed: response.modelUsed };
  }

  console.warn(`[Gemini] First JSON parse/validation failed: ${firstResult.error}. Attempting repair...`);

  // Attempt 2: repair loop — send the raw text back to Gemini to fix
  const repairPrompt = `The following text was supposed to be valid JSON${schemaDescription ? ` matching this schema: ${schemaDescription}` : ""}, but it failed to parse or validate.

Raw text:
${response.text.slice(0, 4000)}

Error: ${firstResult.error}

Fix it and return ONLY valid JSON. No prose, no explanation, no markdown fences. Just the corrected JSON object.`;

  try {
    const repairResponse = await callGemini(repairPrompt);
    totalTokens += repairResponse.tokenCount ?? 0;

    const secondResult = tryParseAndValidate(repairResponse.text, schema);
    if (secondResult.success) {
      return { data: secondResult.data, tokenCount: totalTokens, modelUsed: response.modelUsed };
    }

    throw new Error(`Gemini repair failed validation: ${secondResult.error}`);
  } catch (repairError) {
    // If original parse succeeded but validation failed, try returning the raw parsed data
    // to allow callers to handle partial data
    const rawParsed = tryRawParse(response.text);
    if (rawParsed) {
      const lenient = schema.safeParse(rawParsed);
      if (lenient.success) {
        return { data: lenient.data, tokenCount: totalTokens, modelUsed: response.modelUsed };
      }
    }

    throw new Error(
      `Gemini returned invalid data after repair attempt. ${repairError instanceof Error ? repairError.message : "Please try regenerating."}`
    );
  }
}

function tryParseAndValidate<T>(
  text: string,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  const cleaned = stripJsonFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { success: false, error: `Invalid JSON: ${cleaned.slice(0, 100)}...` };
  }
  const result = schema.safeParse(parsed);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return { success: false, error: `Validation failed: ${issues}` };
}

function tryRawParse(text: string): unknown | null {
  try {
    return JSON.parse(stripJsonFences(text));
  } catch {
    return null;
  }
}

/**
 * Validate the parsed article data has all required fields.
 */
export function validateArticleData(data: Record<string, unknown>): {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  markdown: string;
  faq: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ text: string; url: string }>;
  sources: Array<{ url: string; title: string; publisher: string }>;
  confidenceLevel: "HIGH" | "LOW";
} {
  const required = [
    "title",
    "slug",
    "metaTitle",
    "metaDescription",
    "markdown",
  ];
  for (const field of required) {
    if (!data[field] || typeof data[field] !== "string") {
      throw new Error(`Generated article is missing required field: ${field}`);
    }
  }

  // Validate no em dashes in any text field
  const emDashPattern = /\u2014|\u2013/;
  const textFields = ["title", "slug", "metaTitle", "metaDescription", "markdown"];
  for (const field of textFields) {
    if (typeof data[field] === "string" && emDashPattern.test(data[field] as string)) {
      // Auto-fix: replace em/en dashes with colons or commas
      (data as Record<string, string>)[field] = (data[field] as string)
        .replace(/\u2014/g, ", ")
        .replace(/\u2013/g, ", ");
    }
  }

  // Also check FAQ for em dashes
  const faq = Array.isArray(data.faq) ? data.faq : [];
  for (const item of faq) {
    if (item.question && emDashPattern.test(item.question)) {
      item.question = item.question.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");
    }
    if (item.answer && emDashPattern.test(item.answer)) {
      item.answer = item.answer.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");
    }
  }

  // Validate meta title length
  const metaTitle = data.metaTitle as string;
  if (metaTitle.length > 60) {
    (data as Record<string, string>).metaTitle = metaTitle.slice(0, 57) + "...";
  }

  // Validate meta description length
  const metaDesc = data.metaDescription as string;
  if (metaDesc.length > 160) {
    (data as Record<string, string>).metaDescription = metaDesc.slice(0, 157) + "...";
  }

  return {
    title: data.title as string,
    slug: data.slug as string,
    metaTitle: data.metaTitle as string,
    metaDescription: data.metaDescription as string,
    markdown: data.markdown as string,
    faq: faq as Array<{ question: string; answer: string }>,
    internalLinks: (Array.isArray(data.internalLinks) ? data.internalLinks : []) as Array<{
      text: string;
      url: string;
    }>,
    sources: (Array.isArray(data.sources) ? data.sources : []) as Array<{
      url: string;
      title: string;
      publisher: string;
    }>,
    confidenceLevel: data.confidenceLevel === "LOW" ? "LOW" : "HIGH",
  };
}
