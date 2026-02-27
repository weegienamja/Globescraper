/**
 * Cambodia news topic discovery.
 *
 * Uses a multi-strategy approach:
 * 1. RSS feeds from reputable local and international publishers
 * 2. Google Custom Search JSON API (if configured) for recent Cambodia news
 * 3. Gemini to analyze and curate the raw discoveries into blog topic candidates
 *
 * Never scrapes Google HTML directly.
 */

import { callGemini, validateGeminiKey, parseGeminiJson, callGeminiWithSchema } from "@/lib/ai/geminiClient";
import { z } from "zod";
import {
  getSourcesWithRss,
  findTrustedSource,
  isBlockedDomain,
  NEWS_SOURCE_REGISTRY,
  type TrustedSource,
} from "@/lib/newsSourcePolicy";
import { isAllowedByRobots } from "@/lib/robots/robotsCheck";
import { fetchPage } from "@/lib/scrape/fetchPage";
import { extractMainText, extractTitle } from "@/lib/scrape/extractMainText";
import type {
  NewsTopic,
  CityFocus,
  AudienceFocus,
} from "@/lib/newsTopicTypes";
import { scoreAndRankTopics } from "@/lib/newsTopicScoring";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const MAX_RSS_ITEMS_PER_FEED = 15;
const MAX_SEARCH_RESULTS = 20;
const MAX_TOTAL_RAW_ITEMS = 60;
const DISCOVERY_TIMEOUT_MS = 8_000;

const USER_AGENT = "GlobescraperBot/1.0 (+https://globescraper.com; research-only)";

/* ------------------------------------------------------------------ */
/*  Raw discovery item                                                  */
/* ------------------------------------------------------------------ */

export interface RawDiscoveryItem {
  title: string;
  url: string;
  snippet?: string;
  publisher: string;
  publishedAt?: string;
  source: "rss" | "search_api" | "direct";
}

/* ------------------------------------------------------------------ */
/*  RSS Feed Fetching                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse simple RSS/Atom XML to extract items.
 * Intentionally lightweight: avoids full XML parser dependency.
 */
function parseRssItems(xml: string, publisher: string, feedUrl: string): RawDiscoveryItem[] {
  const items: RawDiscoveryItem[] = [];

  // Match RSS <item> elements
  const rssItemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  // Match Atom <entry> elements
  const atomEntryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;

  const allMatches = [
    ...Array.from(xml.matchAll(rssItemRegex)),
    ...Array.from(xml.matchAll(atomEntryRegex)),
  ];

  for (const match of allMatches.slice(0, MAX_RSS_ITEMS_PER_FEED)) {
    const block = match[1];

    const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch =
      block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) ||
      block.match(/<link[^>]*href="([^"]+)"/i);
    const descMatch =
      block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) ||
      block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
    const dateMatch =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);

    const title = titleMatch?.[1]?.trim();
    const link = linkMatch?.[1]?.trim();
    if (!title || !link) continue;

    // Strip HTML from snippet
    const rawSnippet = descMatch?.[1]?.trim() || "";
    const snippet = rawSnippet.replace(/<[^>]+>/g, "").slice(0, 300);

    items.push({
      title,
      url: link.startsWith("http") ? link : new URL(link, feedUrl).toString(),
      snippet: snippet || undefined,
      publisher,
      publishedAt: dateMatch?.[1]?.trim(),
      source: "rss",
    });
  }

  return items;
}

/**
 * Fetch RSS feeds from trusted sources.
 */
async function fetchRssFeeds(): Promise<RawDiscoveryItem[]> {
  const rssSourcesTmp = getSourcesWithRss();
  const results: RawDiscoveryItem[] = [];

  const fetches = rssSourcesTmp.map(async (source) => {
    if (!source.rssUrl) return [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

      const response = await fetch(source.rssUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return [];
      const xml = await response.text();
      return parseRssItems(xml, source.publisher, source.rssUrl);
    } catch {
      return [];
    }
  });

  const allResults = await Promise.allSettled(fetches);
  for (const r of allResults) {
    if (r.status === "fulfilled") {
      results.push(...r.value);
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Search API (Google CSE)                                             */
/* ------------------------------------------------------------------ */

/**
 * Search for recent Cambodia news using Google Custom Search JSON API.
 * Falls back gracefully if not configured.
 */
async function searchViaGoogleCSE(
  queries: string[]
): Promise<RawDiscoveryItem[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return [];

  const results: RawDiscoveryItem[] = [];
  const seenUrls = new Set<string>();

  // Calculate date range: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateRestrict = "d30";

  for (const query of queries.slice(0, 4)) {
    try {
      const params = new URLSearchParams({
        key: apiKey,
        cx: cseId,
        q: query,
        num: "10",
        dateRestrict,
        sort: "date",
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!response.ok) continue;
      const data = await response.json();

      for (const item of data.items || []) {
        const url = item.link;
        if (!url || seenUrls.has(url)) continue;
        if (isBlockedDomain(url)) continue;

        seenUrls.add(url);
        const trusted = findTrustedSource(url);
        results.push({
          title: item.title || "",
          url,
          snippet: item.snippet || undefined,
          publisher: trusted?.publisher || item.displayLink || "Unknown",
          publishedAt: item.pagemap?.metatags?.[0]?.["article:published_time"],
          source: "search_api",
        });
      }
    } catch {
      // Continue with other queries
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Build discovery queries                                             */
/* ------------------------------------------------------------------ */

function buildDiscoveryQueries(
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): string[] {
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const base = [
    `${city} news latest`,
    `Cambodia visa update ${new Date().getFullYear()}`,
    `Cambodia travel advisory`,
    `Cambodia border rules update`,
  ];

  if (audienceFocus === "travellers" || audienceFocus === "both") {
    base.push(
      `${city} travel disruption`,
      `Cambodia tourism news`,
      `Cambodia transport update`,
      `Cambodia safety advisory`,
    );
  }

  if (audienceFocus === "teachers" || audienceFocus === "both") {
    base.push(
      `Cambodia teaching English news`,
      `Cambodia work permit update`,
      `Cambodia school policy change`,
      `Cambodia expat cost of living`,
    );
  }

  return base;
}

/* ------------------------------------------------------------------ */
/*  Filter for Cambodia relevance                                       */
/* ------------------------------------------------------------------ */

const CAMBODIA_KEYWORDS = [
  "cambodia", "khmer", "phnom penh", "siem reap", "angkor",
  "kampot", "battambang", "sihanoukville", "koh rong",
  "e-visa", "evisa", "mekong", "tonle sap",
];

function isCambodiaRelevant(item: RawDiscoveryItem): boolean {
  const combined = `${item.title} ${item.snippet || ""} ${item.url}`.toLowerCase();
  return CAMBODIA_KEYWORDS.some((kw) => combined.includes(kw));
}

/* ------------------------------------------------------------------ */
/*  Gemini topic curation                                               */
/* ------------------------------------------------------------------ */

async function curateTopicsWithGemini(
  rawItems: RawDiscoveryItem[],
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): Promise<NewsTopic[]> {
  validateGeminiKey();

  const currentDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const currentYear = new Date().getFullYear();

  const itemsSummary = rawItems
    .slice(0, 40)
    .map(
      (item, i) =>
        `${i + 1}. [${item.publisher}] "${item.title}" - ${item.snippet || "No snippet"} (URL: ${item.url}${item.publishedAt ? `, Published: ${item.publishedAt}` : ""})`
    )
    .join("\n");

  const audienceDesc =
    audienceFocus === "both"
      ? "both travellers to Cambodia and people interested in teaching English there"
      : audienceFocus === "travellers"
        ? "travellers to Cambodia"
        : "people interested in teaching English in Cambodia";

  const prompt = `You are a news editor for GlobeScraper, a website about moving to and visiting Cambodia.

TODAY'S DATE: ${currentDate}
CURRENT YEAR: ${currentYear}

Analyze these recent news items and produce 6 to 10 strong blog topic ideas for ${audienceDesc}.
Focus area: ${cityFocus}.

NEWS ITEMS:
${itemsSummary}

TOPIC SELECTION CRITERIA:
- Visa and entry requirements changes
- E-visa updates
- Border rules
- Transport disruptions, airline changes, major roadworks
- Safety advisories and scam trends
- Health updates relevant to travellers
- New teaching policies, school rules, work permit changes
- Cost changes that affect living and travel
- Noteworthy openings (coworking spaces, areas changing fast, major venues)
- Major political or legal changes that could disrupt travel or work plans

QUALITY RULES:
- Each topic must have at least 2 source URLs from the items above (unless it is a clear official announcement with 1 source).
- Each topic must explain clearly why it matters to the audience.
- Do not include sensational topics with weak sourcing.
- Prefer topics where the news is recent (last 7 days preferred, last 30 days acceptable).
- Group related news items into single coherent topics.
- When including a year in titles, ALWAYS use the current year (${currentYear}). NEVER use past years like ${currentYear - 1}.

NEVER use em dashes in any output. Use commas, colons, or semicolons instead.

Return a JSON object:
{
  "topics": [
    {
      "id": "unique-short-id",
      "title": "Blog post title idea (no em dashes)",
      "angle": "Specific angle to cover this from",
      "whyItMatters": "One sentence explaining why the audience should care",
      "audienceFit": ["TRAVELLERS", "TEACHERS"],
      "suggestedKeywords": {
        "target": "primary keyword phrase",
        "secondary": ["keyword2", "keyword3"]
      },
      "sourceUrls": ["url1", "url2"],
      "sourceCount": 2,
      "freshnessScore": 8,
      "riskLevel": "LOW"
    }
  ]
}

freshnessScore: 1-10 (10 = breaking news today, 5 = last week, 1 = month old)
riskLevel: LOW (well sourced), MEDIUM (needs more verification), HIGH (single weak source)

Return ONLY the JSON. No markdown fences. No commentary.`;

  const response = await callGemini(prompt);
  const parsed = parseGeminiJson(response.text);

  if (!parsed.topics || !Array.isArray(parsed.topics)) {
    throw new Error("Gemini did not return a valid topics array.");
  }

  // Validate and clean each topic
  const topics: NewsTopic[] = [];
  for (const raw of parsed.topics) {
    if (!raw.id || !raw.title || !raw.angle || !raw.whyItMatters) continue;

    // Strip any em dashes
    const cleanStr = (s: string) => s.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");

    topics.push({
      id: String(raw.id),
      title: cleanStr(String(raw.title)),
      angle: cleanStr(String(raw.angle)),
      whyItMatters: cleanStr(String(raw.whyItMatters)),
      audienceFit: Array.isArray(raw.audienceFit)
        ? raw.audienceFit.filter((a: string) => a === "TRAVELLERS" || a === "TEACHERS")
        : ["TRAVELLERS", "TEACHERS"],
      suggestedKeywords: {
        target: String(raw.suggestedKeywords?.target || raw.title),
        secondary: Array.isArray(raw.suggestedKeywords?.secondary)
          ? raw.suggestedKeywords.secondary.map(String)
          : [],
      },
      sourceUrls: Array.isArray(raw.sourceUrls) ? raw.sourceUrls.map(String) : [],
      sourceCount: Number(raw.sourceCount) || 0,
      freshnessScore: Math.min(10, Math.max(1, Number(raw.freshnessScore) || 5)),
      riskLevel: ["LOW", "MEDIUM", "HIGH"].includes(raw.riskLevel) ? raw.riskLevel : "MEDIUM",
    });
  }

  return topics;
}

/* ------------------------------------------------------------------ */
/*  Main discovery function                                             */
/* ------------------------------------------------------------------ */

export async function discoverNewsTopics(
  cityFocus: CityFocus = "Cambodia wide",
  audienceFocus: AudienceFocus = "both"
): Promise<NewsTopic[]> {
  // 1. Build search queries
  const queries = buildDiscoveryQueries(cityFocus, audienceFocus);

  // 2. Fetch from multiple sources in parallel
  const [rssItems, searchItems] = await Promise.all([
    fetchRssFeeds(),
    searchViaGoogleCSE(queries),
  ]);

  // 3. Merge and deduplicate
  const seenUrls = new Set<string>();
  const allItems: RawDiscoveryItem[] = [];

  // Search API results first (usually higher quality for trending topics)
  for (const item of searchItems) {
    if (seenUrls.has(item.url) || !isCambodiaRelevant(item)) continue;
    seenUrls.add(item.url);
    allItems.push(item);
  }

  // Then RSS items
  for (const item of rssItems) {
    if (seenUrls.has(item.url)) continue;
    // RSS from Cambodia-focused outlets are inherently relevant
    const trusted = findTrustedSource(item.url);
    const isCambodiaOutlet = trusted?.category === "LOCAL_NEWS" || isCambodiaRelevant(item);
    if (!isCambodiaOutlet) continue;
    seenUrls.add(item.url);
    allItems.push(item);
  }

  // Cap total items
  const capped = allItems.slice(0, MAX_TOTAL_RAW_ITEMS);

  if (capped.length === 0) {
    // Fallback: provide some default queries to Gemini to generate topics from knowledge
    const fallbackItems: RawDiscoveryItem[] = queries.map((q) => ({
      title: q,
      url: "https://globescraper.com",
      publisher: "Search query",
      source: "direct" as const,
    }));
    const topics = await curateTopicsWithGemini(fallbackItems, cityFocus, audienceFocus);
    return scoreAndRankTopics(topics).slice(0, 10);
  }

  // 4. Use Gemini to curate into blog topics
  const topics = await curateTopicsWithGemini(capped, cityFocus, audienceFocus);

  // 5. Score and rank
  return scoreAndRankTopics(topics).slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Seeded discovery (from a generated title)                           */
/* ------------------------------------------------------------------ */

const RefinedTitleSchema = z.object({
  refinedTitle: z.string(),
  clarifyingAngle: z.string(),
  mustAnswerQuestions: z.array(z.string()),
  queryTerms: z.array(z.string()),
});

/**
 * Discover topics seeded from a specific title.
 *
 * 1. Extract keywords from the title
 * 2. If too generic, refine via Gemini
 * 3. Search RSS feeds filtered by keywords
 * 4. Search via Google CSE if available
 * 5. Curate into topic cards via Gemini
 */
export async function discoverNewsTopicsFromTitle(
  seedTitle: string,
  cityFocus: CityFocus = "Cambodia wide",
  audienceFocus: AudienceFocus = "both"
): Promise<NewsTopic[]> {
  const { extractKeywords } = await import("@/lib/news/coverageAnalysis");
  const extracted = extractKeywords(seedTitle);

  let queryTerms = extracted.keywords;
  let title = seedTitle;
  let angle = "";

  // If generic, refine via Gemini
  if (extracted.isGeneric) {
    validateGeminiKey();
    try {
      const result = await callGeminiWithSchema(
        `You are a news editor for GlobeScraper, a website about Cambodia travel and teaching.

The admin wants to write about: "${seedTitle}"
City focus: ${cityFocus}
Audience: ${audienceFocus === "both" ? "travellers and teachers" : audienceFocus}

This title is too generic. Refine it into a specific, clear topic.

Return JSON only:
{
  "refinedTitle": "A specific, clear blog post title (no em dashes)",
  "clarifyingAngle": "The specific angle to cover",
  "mustAnswerQuestions": ["Question 1?", "Question 2?", "Question 3?"],
  "queryTerms": ["keyword1", "keyword2", "keyword3"]
}`,
        RefinedTitleSchema,
        "RefinedTitle with refinedTitle, clarifyingAngle, mustAnswerQuestions, queryTerms"
      );
      title = result.data.refinedTitle;
      angle = result.data.clarifyingAngle;
      queryTerms = result.data.queryTerms;
    } catch (err) {
      console.warn("[News Discovery] Title refinement failed, using original:", err);
    }
  }

  // Build search queries from the title keywords
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const searchQueries = [
    `${title} ${city}`,
    ...queryTerms.slice(0, 3).map((kw) => `Cambodia ${kw}`),
    `${city} ${queryTerms.slice(0, 2).join(" ")}`,
  ];

  // Fetch from multiple sources in parallel
  const [rssItems, searchItems] = await Promise.all([
    fetchRssFeedsFiltered(queryTerms),
    searchViaGoogleCSE(searchQueries),
  ]);

  // Merge and deduplicate
  const seenUrls = new Set<string>();
  const allItems: RawDiscoveryItem[] = [];

  for (const item of searchItems) {
    if (seenUrls.has(item.url) || !isCambodiaRelevant(item)) continue;
    seenUrls.add(item.url);
    allItems.push(item);
  }

  for (const item of rssItems) {
    if (seenUrls.has(item.url)) continue;
    const trusted = findTrustedSource(item.url);
    const isCambodiaOutlet = trusted?.category === "LOCAL_NEWS" || isCambodiaRelevant(item);
    if (!isCambodiaOutlet) continue;
    seenUrls.add(item.url);
    allItems.push(item);
  }

  const capped = allItems.slice(0, MAX_TOTAL_RAW_ITEMS);

  if (capped.length === 0) {
    // Fallback: create a single topic from the seed title itself
    const fallbackItems: RawDiscoveryItem[] = searchQueries.map((q) => ({
      title: q,
      url: "https://globescraper.com",
      publisher: "Search query",
      source: "direct" as const,
    }));
    const topics = await curateTopicsWithGeminiSeeded(
      fallbackItems, title, angle, cityFocus, audienceFocus
    );
    return scoreAndRankTopics(topics).slice(0, 10);
  }

  // Use Gemini to curate — but bias towards the seed title
  const topics = await curateTopicsWithGeminiSeeded(
    capped, title, angle, cityFocus, audienceFocus
  );

  return scoreAndRankTopics(topics).slice(0, 10);
}

/**
 * Fetch RSS feeds and filter items by query terms.
 */
async function fetchRssFeedsFiltered(queryTerms: string[]): Promise<RawDiscoveryItem[]> {
  const rssSourcesTmp = getSourcesWithRss();
  const results: RawDiscoveryItem[] = [];
  const lowerTerms = queryTerms.map((t) => t.toLowerCase());

  const fetches = rssSourcesTmp.map(async (source) => {
    if (!source.rssUrl) return [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

      const response = await fetch(source.rssUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return [];
      const xml = await response.text();
      const items = parseRssItems(xml, source.publisher, source.rssUrl);

      // Filter by query terms
      return items.filter((item) => {
        const combined = `${item.title} ${item.snippet || ""}`.toLowerCase();
        return lowerTerms.some((term) => combined.includes(term));
      });
    } catch {
      return [];
    }
  });

  const allResults = await Promise.allSettled(fetches);
  for (const r of allResults) {
    if (r.status === "fulfilled") {
      results.push(...r.value);
    }
  }

  return results;
}

/**
 * Curate topics biased towards a seed title.
 */
async function curateTopicsWithGeminiSeeded(
  rawItems: RawDiscoveryItem[],
  seedTitle: string,
  seedAngle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): Promise<NewsTopic[]> {
  validateGeminiKey();

  const currentDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const currentYear = new Date().getFullYear();

  const itemsSummary = rawItems
    .slice(0, 40)
    .map(
      (item, i) =>
        `${i + 1}. [${item.publisher}] "${item.title}" - ${item.snippet || "No snippet"} (URL: ${item.url}${item.publishedAt ? `, Published: ${item.publishedAt}` : ""})`
    )
    .join("\n");

  const audienceDesc =
    audienceFocus === "both"
      ? "both travellers to Cambodia and people interested in teaching English there"
      : audienceFocus === "travellers"
        ? "travellers to Cambodia"
        : "people interested in teaching English in Cambodia";

  const prompt = `You are a news editor for GlobeScraper, a website about moving to and visiting Cambodia.

TODAY'S DATE: ${currentDate}
CURRENT YEAR: ${currentYear}

The admin wants to write about this topic: "${seedTitle}"
${seedAngle ? `Suggested angle: ${seedAngle}` : ""}

Analyze these recent news items and produce 4 to 8 blog topic variations based on the seed topic.
At least the FIRST topic should closely match the seed title. Other topics can be related variations.
Focus area: ${cityFocus}.
Audience: ${audienceDesc}.

NEWS ITEMS:
${itemsSummary}

QUALITY RULES:
- The first topic must match the seed title closely, adapted with sources from the items above.
- Other topics should be related angles, sub-topics, or complementary pieces.
- Each topic must have source URLs from the items above (at least 1, preferably 2+).
- Each topic must explain clearly why it matters to the audience.
- Do not include sensational topics with weak sourcing.
- NEVER use em dashes in any output. Use commas, colons, or semicolons instead.
- When including a year in titles, ALWAYS use the current year (${currentYear}). NEVER use past years like ${currentYear - 1}.

Return a JSON object:
{
  "topics": [
    {
      "id": "unique-short-id",
      "title": "Blog post title idea (no em dashes)",
      "angle": "Specific angle to cover this from",
      "whyItMatters": "One sentence explaining why the audience should care",
      "audienceFit": ["TRAVELLERS", "TEACHERS"],
      "suggestedKeywords": {
        "target": "primary keyword phrase",
        "secondary": ["keyword2", "keyword3"]
      },
      "sourceUrls": ["url1", "url2"],
      "sourceCount": 2,
      "freshnessScore": 8,
      "riskLevel": "LOW",
      "fromSeedTitle": true
    }
  ]
}

Set "fromSeedTitle": true for the topic that most closely matches the admin's seed title.
freshnessScore: 1-10 (10 = breaking news today, 5 = last week, 1 = month old)
riskLevel: LOW (well sourced), MEDIUM (needs more verification), HIGH (single weak source)

Return ONLY the JSON. No markdown fences. No commentary.`;

  const response = await callGemini(prompt);
  const parsed = parseGeminiJson(response.text);

  if (!parsed.topics || !Array.isArray(parsed.topics)) {
    throw new Error("Gemini did not return a valid topics array.");
  }

  const topics: NewsTopic[] = [];
  for (const raw of parsed.topics) {
    if (!raw.id || !raw.title || !raw.angle || !raw.whyItMatters) continue;

    const cleanStr = (s: string) => s.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");

    topics.push({
      id: String(raw.id),
      title: cleanStr(String(raw.title)),
      angle: cleanStr(String(raw.angle)),
      whyItMatters: cleanStr(String(raw.whyItMatters)),
      audienceFit: Array.isArray(raw.audienceFit)
        ? raw.audienceFit.filter((a: string) => a === "TRAVELLERS" || a === "TEACHERS")
        : ["TRAVELLERS", "TEACHERS"],
      suggestedKeywords: {
        target: String(raw.suggestedKeywords?.target || raw.title),
        secondary: Array.isArray(raw.suggestedKeywords?.secondary)
          ? raw.suggestedKeywords.secondary.map(String)
          : [],
      },
      sourceUrls: Array.isArray(raw.sourceUrls) ? raw.sourceUrls.map(String) : [],
      sourceCount: Number(raw.sourceCount) || 0,
      freshnessScore: Math.min(10, Math.max(1, Number(raw.freshnessScore) || 5)),
      riskLevel: ["LOW", "MEDIUM", "HIGH"].includes(raw.riskLevel) ? raw.riskLevel : "MEDIUM",
      fromSeedTitle: Boolean(raw.fromSeedTitle),
    });
  }

  return topics;
}
