/**
 * Prompt templates for the AI Blog Generator.
 * All prompts enforce: no em dashes, active voice, short paragraphs,
 * bullet points, and anti-plagiarism through paraphrasing only.
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
`.trim();

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
  "sources": [{"url": "...", "title": "...", "publisher": "..."}]
}

MARKDOWN STRUCTURE (in order):
1. H1 title (# ...)
2. Short intro paragraph (2-3 sentences, include target keyword in first 100 words)
3. "## Quick Take" section with 5-7 bullet points summarizing the key facts
4. 5-8 H2 sections covering the topic thoroughly
5. Include a "## Costs" section with a Markdown table (if cost info is available)
6. Include a "## Safety and Scams" section
7. Include a "## Common Mistakes" section
8. "## FAQ" section with 5 questions and answers
9. "## Related Guides" section with 5 internal links to other GlobeScraper guides
10. "## Sources" section listing all source URLs used

FAQ rules:
- 5 questions
- Each answer should be 2-3 sentences
- No em dashes in questions or answers

Internal links should point to paths like /blog/cost-of-living-cambodia or /blog/teaching-english-phnom-penh.

Sources section:
- List each source as: [Publisher Name](URL)
- Only include sources actually used in writing
`.trim();

/**
 * Build the full generation prompt with research data.
 */
export function buildGenerationPrompt(
  factsPack: FactsPack,
  wordCount: number
): string {
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
`;

  return `
You are a professional travel and expat content writer for GlobeScraper, a website that helps English teachers and expats move to Cambodia.

Write a ${wordCount}-word SEO article about "${factsPack.topic}" in ${factsPack.city}, Cambodia.

Target audience: ${factsPack.audience}
${factsPack.targetKeyword ? `Primary keyword: ${factsPack.targetKeyword}` : ""}
${factsPack.secondaryKeywords ? `Secondary keywords: ${factsPack.secondaryKeywords}` : ""}

${STYLE_RULES}

${researchSection}

${OUTPUT_FORMAT}

IMPORTANT REMINDERS:
- Target approximately ${wordCount} words for the markdown content.
- No em dashes anywhere in the entire output.
- Return ONLY the JSON object. No markdown code fences around it.
- Ensure the JSON is valid and parseable.
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
  secondaryKeywords?: string
): string {
  return `
You are a professional travel and expat content writer for GlobeScraper, a website that helps English teachers and expats move to Cambodia.

Write a ${wordCount}-word SEO article about "${topic}" in ${city}, Cambodia.

Target audience: ${audience}
${targetKeyword ? `Primary keyword: ${targetKeyword}` : ""}
${secondaryKeywords ? `Secondary keywords: ${secondaryKeywords}` : ""}

NOTE: No external research data is available for this article. Write based on your general knowledge. Be careful to present information as general guidance, not as verified current facts. Include disclaimers where appropriate.

${STYLE_RULES}

${OUTPUT_FORMAT}

IMPORTANT REMINDERS:
- Target approximately ${wordCount} words for the markdown content.
- No em dashes anywhere in the entire output.
- Return ONLY the JSON object. No markdown code fences around it.
- Ensure the JSON is valid and parseable.
- For the "sources" array, return an empty array since no sources were used.
`.trim();
}
