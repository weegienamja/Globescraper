/**
 * Prompt templates for the AI Blog Generator.
 * All prompts enforce: no em dashes, active voice, short paragraphs,
 * bullet points, and anti-plagiarism through paraphrasing only.
 *
 * v2: Added competitor gap analysis, humanization pass, depth upgrades,
 *     author card, "how we researched this" block, data-checked line.
 */

import type { FactsPack } from "@/lib/scrape/buildFactsPack";

const BANNED_WORDS = [
  "accordingly",
  "moreover",
  "robust",
  "vibrant",
  "innovative",
  "furthermore",
  "consequently",
  "nevertheless",
  "notwithstanding",
  "henceforth",
  "utilize",
  "leverage",
  "synergy",
  "paradigm",
  "holistic",
  "streamline",
  "cutting-edge",
  "game-changer",
  "ecosystem",
  "deep dive",
];

const STYLE_RULES = `
STRICT STYLE RULES (you must follow every rule):

1. NEVER use em dashes anywhere. Not in titles, headings, body text, FAQs, meta descriptions, or any part of the output. Use commas, periods, colons, or semicolons instead.
2. Write in active voice. Avoid passive constructions.
3. Use short sentences. Most sentences should be under 20 words.
4. Use short paragraphs. Maximum 3 sentences per paragraph.
5. Use frequent line breaks between paragraphs.
6. Use bullet points and numbered lists often.
7. Write in a direct, conversational tone. No corporate speak.
8. Never use these banned words: ${BANNED_WORDS.join(", ")}.
9. Only paraphrase and summarize from sources. Never copy text verbatim.
10. Include specific numbers, prices, and practical details.
11. Write for someone who has never visited Cambodia before.
12. Be honest about downsides. Do not oversell.
13. Use "you" and "your" to address the reader directly.
14. Mix in first-person observations where natural (e.g. "When I first arrived in Phnom Penh..."). Use sparingly.
15. Include real-world scenarios with specific numbers (e.g. "A studio apartment near BKK1 costs about $350/month.").
`.trim();

const DEPTH_INSTRUCTIONS = `
DEPTH AND QUALITY UPGRADES:
- Open with a "What I wish I knew before..." style intro from first person perspective.
- In the Common Mistakes section, go beyond generic tips. Use specific scenarios with dollar amounts and consequences.
- Include at least 2 real-world "day in the life" scenarios to ground the advice.
- Every cost or number claim should include a date range or "as of" qualifier.
- Never present outdated data as current. When uncertain, say "prices vary" or "check locally."
- When referencing a year in titles, headings, or body text, ALWAYS use the current year. NEVER use past years unless specifically discussing historical data.
`.trim();

// Author card removed: users should not see AI attribution.

// "How we researched this" collapsible removed: no <details> HTML in output.

const OUTPUT_FORMAT = `
OUTPUT FORMAT:
Return a single JSON object with exactly these keys:
{
  "title": "H1 title (under 70 chars, no em dashes)",
  "slug": "url-friendly-slug-with-hyphens",
  "metaTitle": "SEO title under 60 chars (no em dashes)",
  "metaDescription": "140-160 chars (no em dashes)",
  "markdown": "Full article in Markdown format",
  "faq": [{"question": "...", "answer": "..."}],
  "internalLinks": [{"text": "...", "url": "/blog/..."}],
  "sources": [{"url": "...", "title": "...", "publisher": "..."}],
  "confidenceLevel": "HIGH or LOW (LOW if fewer than 3 real sources used)"
}

MARKDOWN STRUCTURE (in order):
1. H1 title (# ...)
2. "Data last checked: {Month Year}" line in italics
3. Short intro paragraph (2-3 sentences, include target keyword in first 100 words)
4. "## Quick Take" section with 5-7 bullet points summarizing the key facts
5. A "## What I Wish I Knew" section with 3-5 first-person insights
6. 5-8 H2 sections covering the topic thoroughly
7. Include a "## Costs" section with a Markdown table (if cost info is available). Keep tables to 2-3 columns max for mobile readability. Use short column headers (e.g. "Item", "Cost" not "Monthly Cost in USD"). Keep cell content concise.
8. Include a "## Safety and Scams" section
9. Include a "## Common Mistakes" section with specific scenarios and dollar amounts
10. "## FAQ" section with 5 questions and answers
11. "## Related Guides" section with 5 internal links to other GlobeScraper guides

DO NOT include an "About the Author" section.
DO NOT include a "Sources" section in the markdown. Sources are tracked separately.
DO NOT include any HTML tags like <details>, <summary>, or any other raw HTML. Use only standard Markdown.
DO NOT include any image markdown (![...](...)) in the output. Images are generated and injected separately. Never invent or hallucinate image URLs.

FAQ rules:
- 5 questions
- Format each as a bold question on its own line, then the answer on the next line. Example:
  **What is the average rent in Phnom Penh?**
  A one-bedroom apartment in BKK1 costs about $350 to $500 per month.
- Do NOT prefix questions with "Q:" and do NOT prefix answers with "A:"
- Each answer should be 2-3 sentences
- No em dashes in questions or answers

Internal links should point to paths like /cost-of-living-cambodia or /teaching-english-phnom-penh (no /blog/ prefix).
`.trim();

/**
 * Build the full generation prompt with research data and competitor analysis.
 */
export function buildGenerationPrompt(
  factsPack: FactsPack,
  wordCount: number,
  competitorAnalysis?: string,
  existingContentDigest?: string
): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayFormatted = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const researchSection =
    factsPack.sourceCount > 0
      ? `
RESEARCH DATA (paraphrase only, do not copy):
${factsPack.combinedBulletPoints}
`
      : `
NO RESEARCH DATA AVAILABLE.
Write based on your knowledge of ${factsPack.city}, Cambodia.
Focus on practical, actionable advice for the audience.
Mark all claims as general guidance.
Set confidenceLevel to "LOW".
`;

  const competitorSection = competitorAnalysis
    ? `
${competitorAnalysis}

USE THE GAP ANALYSIS: If the gap analysis identifies subtopics competitors cover but our sources do not, cover those subtopics in your article using your knowledge. Mark any claims not backed by our sources as general guidance.
`
    : "";

  const existingContentSection = existingContentDigest || "";

  return `
You are a professional travel and expat content writer for GlobeScraper, a website that helps English teachers and expats move to Cambodia.

TODAY'S DATE: ${todayFormatted}
CURRENT YEAR: ${currentYear}

Write a ${wordCount}-word SEO article about "${factsPack.topic}" in ${factsPack.city}, Cambodia.

Target audience: ${factsPack.audience}
${factsPack.targetKeyword ? `Primary keyword: ${factsPack.targetKeyword}` : ""}
${factsPack.secondaryKeywords ? `Secondary keywords: ${factsPack.secondaryKeywords}` : ""}

${STYLE_RULES}

${DEPTH_INSTRUCTIONS}

${researchSection}
${competitorSection}
${existingContentSection}


${OUTPUT_FORMAT}

IMPORTANT REMINDERS:
- Target approximately ${wordCount} words for the markdown content.
- No em dashes anywhere in the entire output. Zero. Check every sentence.
- Return ONLY the JSON object. No markdown code fences around it.
- Ensure the JSON is valid and parseable.
- Set confidenceLevel to "LOW" if fewer than 3 sources had usable data.
`.trim();
}

/**
 * Build the humanization pass prompt.
 * Takes the initial draft and rewrites for naturalness and style compliance.
 */
export function buildHumanizationPrompt(rawMarkdown: string): string {
  return `
You are an expert editorial rewriter. Your job is to take an AI-generated article and make it read like a human wrote it.

Here is the article in Markdown:

${rawMarkdown}

REWRITE RULES:
1. NEVER use em dashes. Replace every em dash with a comma, period, colon, or semicolon.
2. Vary sentence length naturally. Mix short punchy sentences with medium ones.
3. Add transitional phrases that feel natural, not formulaic.
4. Replace any stiff or robotic phrasing with casual alternatives.
5. Keep all facts, numbers, prices, and structure exactly the same.
6. Keep all Markdown formatting (headings, lists, tables, links) exactly the same.
7. Remove any HTML blocks (like <details>, <summary>) entirely. Replace them with plain Markdown.
8. Remove any "About the Author" section if present.
9. Remove any image markdown lines (![...](...)) entirely. Images are handled separately.
10. Do not add or remove any sections (other than those specified above for removal).
11. Never use these words: ${BANNED_WORDS.join(", ")}.
12. Keep total word count within 5% of the original.

Return ONLY the rewritten Markdown. No JSON wrapping. No code fences.
`.trim();
}

/**
 * Build a simpler prompt for idea-only generation (no sources found).
 */
export function buildIdeaOnlyPrompt(
  city: string,
  topic: string,
  audience: string,
  wordCount: number,
  targetKeyword?: string,
  secondaryKeywords?: string,
  existingContentDigest?: string
): string {
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const currentYear = now.getFullYear();
  const todayFormatted = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return `
TODAY'S DATE: ${todayFormatted}
CURRENT YEAR: ${currentYear}

You are a professional travel and expat content writer for GlobeScraper, a website that helps English teachers and expats move to Cambodia.

Write a ${wordCount}-word SEO article about "${topic}" in ${city}, Cambodia.

Target audience: ${audience}
${targetKeyword ? `Primary keyword: ${targetKeyword}` : ""}
${secondaryKeywords ? `Secondary keywords: ${secondaryKeywords}` : ""}

NOTE: No external research data is available for this article. Write based on your general knowledge. Be careful to present information as general guidance, not as verified current facts. Include disclaimers where appropriate.

${STYLE_RULES}

${DEPTH_INSTRUCTIONS}

${existingContentDigest || ""}


${OUTPUT_FORMAT}

IMPORTANT REMINDERS:
- Target approximately ${wordCount} words for the markdown content.
- No em dashes anywhere in the entire output.
- Return ONLY the JSON object. No markdown code fences around it.
- Ensure the JSON is valid and parseable.
- Set confidenceLevel to "LOW" since no sources were used.
- For the "sources" array, return an empty array since no sources were used.
`.trim();
}
