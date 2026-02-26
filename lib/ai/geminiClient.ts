/**
 * Gemini API client for the AI Blog Generator.
 * Uses the Gemini REST API directly (no SDK dependency needed).
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-2.5-flash";

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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Extract text from the response
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error("Gemini returned an empty or blocked response.");
  }

  const text = candidate.content.parts[0].text;

  // Try to get token usage
  const tokenCount = data.usageMetadata?.totalTokenCount ?? null;

  return {
    text,
    tokenCount,
    modelUsed: MODEL,
  };
}

/**
 * Parse the JSON response from Gemini, handling potential issues.
 */
export function parseGeminiJson(text: string): Record<string, unknown> {
  // Remove markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Gemini returned invalid JSON. Please try regenerating.");
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
  };
}
