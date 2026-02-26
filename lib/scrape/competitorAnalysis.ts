/**
 * Competitor depth analysis for the AI Blog Generator.
 *
 * Fetches competitor articles, extracts their outline (H2/H3 headings),
 * and performs gap analysis against our planned outline to identify
 * missing subtopics and depth improvements.
 */

import { fetchPage } from "./fetchPage";
import { extractMainText, extractTitle } from "./extractMainText";

export interface CompetitorOutline {
  url: string;
  title: string | null;
  headings: CompetitorHeading[];
  wordCount: number;
  accessError?: string;
}

export interface CompetitorHeading {
  level: number; // 2 or 3
  text: string;
}

export interface GapAnalysis {
  competitorOutlines: CompetitorOutline[];
  /** Subtopics found in competitors but not covered by our sources */
  missingTopics: string[];
  /** Depth recommendations based on competitor patterns */
  depthRecommendations: string[];
  /** Average word count of accessible competitors */
  avgCompetitorWordCount: number;
  /** Summary string to inject into the generation prompt */
  promptSummary: string;
}

/**
 * Extract headings (H2 and H3) from raw HTML.
 */
function extractHeadingsFromHtml(html: string): CompetitorHeading[] {
  const headings: CompetitorHeading[] = [];
  const regex = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    // Strip inner HTML tags
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text.length > 0 && text.length < 200) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * Estimate word count from extracted text.
 */
function estimateWordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Fetch a competitor page and extract its outline.
 */
async function analyzeCompetitor(url: string): Promise<CompetitorOutline> {
  try {
    const html = await fetchPage(url);

    if (!html) {
      return {
        url,
        title: null,
        headings: [],
        wordCount: 0,
        accessError: "Could not fetch page (robots.txt blocked or fetch failed)",
      };
    }

    const title = extractTitle(html);
    const headings = extractHeadingsFromHtml(html);
    const mainText = extractMainText(html);
    const wordCount = estimateWordCount(mainText);

    return { url, title, headings, wordCount };
  } catch (error) {
    return {
      url,
      title: null,
      headings: [],
      wordCount: 0,
      accessError: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Normalize a heading for comparison.
 */
function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build gap analysis by comparing competitor outlines against our facts pack.
 */
function buildGapAnalysis(
  outlines: CompetitorOutline[],
  ourSourceBullets: string,
  topic: string
): GapAnalysis {
  const ourContentLower = ourSourceBullets.toLowerCase();
  const missingTopics: string[] = [];
  const allCompetitorTopics = new Set<string>();
  const depthRecommendations: string[] = [];

  // Collect all unique competitor headings
  for (const outline of outlines) {
    if (outline.accessError) continue;
    for (const heading of outline.headings) {
      const normalized = normalizeHeading(heading.text);
      if (normalized.length > 3) {
        allCompetitorTopics.add(normalized);
      }
    }
  }

  // Identify topics competitors cover that we may not
  for (const competitorTopic of allCompetitorTopics) {
    const words = competitorTopic.split(" ").filter((w) => w.length > 3);
    // Check if at least half the significant words appear in our content
    const matchCount = words.filter((w) => ourContentLower.includes(w)).length;
    const matchRatio = words.length > 0 ? matchCount / words.length : 1;

    if (matchRatio < 0.5) {
      missingTopics.push(competitorTopic);
    }
  }

  // Calculate average word count
  const accessibleOutlines = outlines.filter((o) => !o.accessError && o.wordCount > 0);
  const avgCompetitorWordCount =
    accessibleOutlines.length > 0
      ? Math.round(
          accessibleOutlines.reduce((sum, o) => sum + o.wordCount, 0) /
            accessibleOutlines.length
        )
      : 0;

  // Depth recommendations
  if (avgCompetitorWordCount > 2500) {
    depthRecommendations.push(
      `Competitors average ${avgCompetitorWordCount} words. Aim for comprehensive coverage.`
    );
  }

  // Check for common patterns across competitors
  const headingCounts = new Map<string, number>();
  for (const outline of outlines) {
    if (outline.accessError) continue;
    for (const heading of outline.headings) {
      const norm = normalizeHeading(heading.text);
      headingCounts.set(norm, (headingCounts.get(norm) || 0) + 1);
    }
  }

  // Topics that appear in 2+ competitors are likely essential
  const essentialTopics = Array.from(headingCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([topic]) => topic);

  if (essentialTopics.length > 0) {
    depthRecommendations.push(
      `Topics covered by multiple competitors (essential): ${essentialTopics.slice(0, 5).join(", ")}`
    );
  }

  // Build the prompt summary
  const outlineSummaries = outlines
    .filter((o) => !o.accessError)
    .map((o) => {
      const headingList = o.headings
        .map((h) => `${"  ".repeat(h.level - 2)}- ${h.text}`)
        .join("\n");
      return `Competitor: ${o.title || o.url} (~${o.wordCount} words)\n${headingList}`;
    })
    .join("\n\n");

  const missingList =
    missingTopics.length > 0
      ? `\nGap Analysis - Subtopics our sources don't cover but competitors do:\n${missingTopics.map((t) => `- ${t}`).join("\n")}`
      : "\nGap Analysis: Our sources cover all major competitor topics.";

  const depthList =
    depthRecommendations.length > 0
      ? `\nDepth Notes:\n${depthRecommendations.map((r) => `- ${r}`).join("\n")}`
      : "";

  const promptSummary = `
=== COMPETITOR ANALYSIS ===
${outlineSummaries}
${missingList}
${depthList}
===========================
`.trim();

  return {
    competitorOutlines: outlines,
    missingTopics,
    depthRecommendations,
    avgCompetitorWordCount,
    promptSummary,
  };
}

/**
 * Run competitor analysis on up to 3 competitor URLs.
 * Respects robots.txt and fails gracefully.
 */
export async function runCompetitorAnalysis(
  competitorUrls: string[],
  ourSourceBullets: string,
  topic: string
): Promise<GapAnalysis> {
  // Validate and limit to 3 URLs
  const validUrls = competitorUrls
    .map((u) => u.trim())
    .filter((u) => {
      try {
        new URL(u);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 3);

  if (validUrls.length === 0) {
    return {
      competitorOutlines: [],
      missingTopics: [],
      depthRecommendations: [],
      avgCompetitorWordCount: 0,
      promptSummary: "",
    };
  }

  // Fetch and analyze all competitor pages in parallel
  const outlines = await Promise.all(validUrls.map(analyzeCompetitor));

  return buildGapAnalysis(outlines, ourSourceBullets, topic);
}
