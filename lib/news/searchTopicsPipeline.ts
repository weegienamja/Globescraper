/**
 * 2-stage Search Topics pipeline for the Cambodia News Blog Generator.
 *
 * Stage A: generateSearchQueries – Gemini returns search queries only
 * Stage B: generateTopicVariations – Gemini returns topics grounded in fetched results
 *
 * This replaces the old single-shot curation that conflated query generation,
 * source discovery, and topic curation into one Gemini call.
 */

import {
  callGemini,
  validateGeminiKey,
  parseGeminiJson,
} from "@/lib/ai/geminiClient";
import { isBlockedDomain, findTrustedSource } from "@/lib/newsSourcePolicy";
import type {
  NewsTopic,
  CityFocus,
  AudienceFocus,
  AudienceFit,
} from "@/lib/newsTopicTypes";

/* ------------------------------------------------------------------ */
/*  Public types                                                        */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  id: string;
  query: string;
  title: string;
  snippet: string;
  url: string;
  publishedAt?: string;
  sourceName?: string;
}

export interface PipelineLog {
  seedTitle: string;
  queryList: string[];
  usableResultCount: number;
  totalTokenUsage: number;
  topicsCount: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const MIN_USABLE_RESULTS = 5;
const MAX_RESULTS = 15;
const SEARCH_TIMEOUT_MS = 8_000;
const USER_AGENT =
  "GlobescraperBot/1.0 (+https://globescraper.com; research-only)";

const VALID_AUDIENCE = new Set<string>(["TRAVELLERS", "TEACHERS"]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Strip em dashes from any string. */
function cleanStr(s: string): string {
  return s.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");
}

/** Check if a string contains em dash. */
function hasEmDash(s: string): boolean {
  return s.includes("\u2014") || s.includes("\u2013");
}

/* ------------------------------------------------------------------ */
/*  Stage A: Generate Search Queries                                    */
/* ------------------------------------------------------------------ */

interface QueriesResult {
  queries: string[];
  tokenUsage: number;
}

/**
 * Ask Gemini to produce 4-6 specific Google search queries
 * derived from the seedTitle, cityFocus, and audienceFocus.
 */
export async function generateSearchQueries(
  seedTitle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus,
  currentYear: number
): Promise<QueriesResult> {
  validateGeminiKey();

  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;

  const prompt = `You are a research assistant for GlobeScraper, a website about Cambodia travel and teaching English.

TASK: Generate Google search queries to research the topic below.

SEED TITLE: "${seedTitle}"
CITY FOCUS: ${cityFocus}
AUDIENCE: ${audienceFocus === "both" ? "travellers and English teachers" : audienceFocus}
CURRENT YEAR: ${currentYear}

RULES:
1. Return 4 to 6 search queries.
2. At least 2 queries MUST include the term "${city}".
3. ${seedTitle.includes(String(currentYear)) ? `At least 1 query MUST include "${currentYear}".` : "Include the year if relevant to the topic."}
4. Queries must be specific. Too vague examples: "Cambodia tips", "travel advice".
5. Do NOT use em dashes (— or –) anywhere.
6. Each query should target a different angle or sub-topic.

Return ONLY this JSON (no markdown fences, no commentary):
{
  "queries": ["query 1", "query 2", "query 3", "query 4"]
}`;

  const response = await callGemini(prompt);
  const parsed = parseGeminiJson(response.text);
  let queries: string[] = Array.isArray(parsed.queries)
    ? parsed.queries.map(String).filter((q: string) => q.length > 3)
    : [];

  // Validate
  const failures = validateQueries(queries, city, seedTitle, currentYear);

  if (failures.length > 0 && queries.length > 0) {
    // Retry once with fix prompt
    const fixPrompt = `The previous query generation had these problems:
${failures.map((f) => `- ${f}`).join("\n")}

Original queries: ${JSON.stringify(queries)}

Fix the queries and return valid JSON:
{
  "queries": ["query 1", "query 2", "query 3", "query 4"]
}

RULES: 4-6 queries, at least 2 must include "${city}", ${seedTitle.includes(String(currentYear)) ? `at least 1 must include "${currentYear}",` : ""} no em dashes, be specific.

Return ONLY the JSON.`;

    const retryResponse = await callGemini(fixPrompt);
    const retryParsed = parseGeminiJson(retryResponse.text);
    const retryQueries: string[] = Array.isArray(retryParsed.queries)
      ? retryParsed.queries.map(String).filter((q: string) => q.length > 3)
      : [];

    const retryFailures = validateQueries(
      retryQueries,
      city,
      seedTitle,
      currentYear
    );

    if (retryFailures.length === 0 && retryQueries.length >= 4) {
      queries = retryQueries;
    }
    // else keep original — some queries are better than none

    return {
      queries: queries.slice(0, 6),
      tokenUsage:
        (response.tokenCount ?? 0) + (retryResponse.tokenCount ?? 0),
    };
  }

  return { queries: queries.slice(0, 6), tokenUsage: response.tokenCount ?? 0 };
}

function validateQueries(
  queries: string[],
  city: string,
  seedTitle: string,
  currentYear: number
): string[] {
  const failures: string[] = [];
  if (queries.length < 4 || queries.length > 6) {
    failures.push(`Expected 4-6 queries, got ${queries.length}.`);
  }
  const cityLower = city.toLowerCase();
  const cityCount = queries.filter((q) =>
    q.toLowerCase().includes(cityLower)
  ).length;
  if (cityCount < 2) {
    failures.push(
      `At least 2 queries must include "${city}". Found ${cityCount}.`
    );
  }
  if (seedTitle.includes(String(currentYear))) {
    const yearCount = queries.filter((q) =>
      q.includes(String(currentYear))
    ).length;
    if (yearCount < 1) {
      failures.push(
        `Seed title contains ${currentYear} but no query includes it.`
      );
    }
  }
  for (const q of queries) {
    if (hasEmDash(q)) {
      failures.push(`Query "${q}" contains an em dash.`);
    }
  }
  return failures;
}

/* ------------------------------------------------------------------ */
/*  Search step (code, not Gemini)                                      */
/* ------------------------------------------------------------------ */

/**
 * Execute web searches for each query via Google CSE.
 * Returns deduplicated, filtered results.
 */
export async function executeSearchQueries(
  queries: string[]
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    console.warn(
      "[SearchTopics] Google CSE not configured — returning empty results"
    );
    return [];
  }

  const seenUrls = new Set<string>();
  const results: SearchResult[] = [];
  let resultId = 0;

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        key: apiKey,
        cx: cseId,
        q: query,
        num: "10",
        dateRestrict: "d30",
        sort: "date",
      });

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        SEARCH_TIMEOUT_MS
      );

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!response.ok) continue;
      const data = await response.json();

      for (const item of data.items || []) {
        const url: string = item.link;
        if (!url) continue;

        // Canonical URL dedup
        const canonical = url.replace(/\/$/, "").replace(/^https?:\/\/www\./, "https://");
        if (seenUrls.has(canonical)) continue;
        if (isBlockedDomain(url)) continue;

        const snippet: string = item.snippet || "";
        // Filter out empty / "No snippet" items
        if (!snippet || snippet.trim().length < 20) continue;

        seenUrls.add(canonical);
        const trusted = findTrustedSource(url);
        resultId++;

        results.push({
          id: `r${resultId}`,
          query,
          title: item.title || "",
          snippet,
          url,
          publishedAt:
            item.pagemap?.metatags?.[0]?.["article:published_time"] ||
            undefined,
          sourceName: trusted?.publisher || item.displayLink || undefined,
        });
      }
    } catch {
      // Continue with other queries
    }
  }

  // Cap at MAX_RESULTS
  return results.slice(0, MAX_RESULTS);
}

/* ------------------------------------------------------------------ */
/*  Stage B: Generate Topic Variations                                  */
/* ------------------------------------------------------------------ */

interface TopicsResult {
  topics: NewsTopic[];
  tokenUsage: number;
}

/**
 * Ask Gemini to produce 4-8 topic variations grounded in the provided
 * search results.  Every sourceUrl must come from results[].url.
 */
export async function generateTopicVariations(
  seedTitle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus,
  currentYear: number,
  results: SearchResult[]
): Promise<TopicsResult> {
  validateGeminiKey();

  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;

  const audienceDesc =
    audienceFocus === "both"
      ? "both travellers to Cambodia and people interested in teaching English there"
      : audienceFocus === "travellers"
        ? "travellers to Cambodia"
        : "people interested in teaching English in Cambodia";

  const resultsList = results
    .map(
      (r) =>
        `[${r.id}] "${r.title}" — ${r.snippet} (URL: ${r.url}${r.publishedAt ? `, Published: ${r.publishedAt}` : ""}${r.sourceName ? `, Source: ${r.sourceName}` : ""})`
    )
    .join("\n");

  const allowedUrls = results.map((r) => r.url);

  const prompt = `You are a news editor for GlobeScraper, a website about moving to and visiting Cambodia.

CURRENT YEAR: ${currentYear}
SEED TITLE: "${seedTitle}"
CITY FOCUS: ${cityFocus}
AUDIENCE: ${audienceDesc}

SEARCH RESULTS:
${resultsList}

TASK: Produce 4 to 8 blog topic variations based on the seed title and grounded in the search results above.

GROUNDING RULES:
1. Every topic must cite 1 to 3 URLs chosen ONLY from the SEARCH RESULTS list above.
2. NEVER invent URLs. NEVER cite globescraper.com unless it appears in the results.
3. The FIRST topic MUST closely match the seed title and have "fromSeedTitle": true.
4. Other topics must be meaningfully different angles, not rewrites of the first.
5. Every topic title MUST include "${city}" (case-insensitive match is fine).
6. ${seedTitle.includes(String(currentYear)) ? `Titles may use ${currentYear} but NEVER any other year.` : `Do not include years unless specifically relevant.`}
7. audienceFit must ONLY be "TRAVELLERS" and/or "TEACHERS". No other values.
8. NEVER use em dashes (— or –) in any field. Use commas, colons, or semicolons instead.

Return ONLY this JSON (no markdown fences, no commentary):
{
  "topics": [
    {
      "id": "short-id",
      "title": "Blog post title",
      "angle": "Specific angle",
      "whyItMatters": "One sentence why the audience should care",
      "audienceFit": ["TRAVELLERS", "TEACHERS"],
      "suggestedKeywords": {
        "target": "primary keyword phrase",
        "secondary": ["keyword2", "keyword3"]
      },
      "searchQueries": ["query 1", "query 2", "query 3"],
      "intent": "One sentence describing user search intent",
      "outlineAngles": ["Sub-section 1", "Sub-section 2", "Sub-section 3"],
      "sourceUrls": ["https://exact-url-from-results"],
      "fromSeedTitle": true
    }
  ]
}`;

  const response = await callGemini(prompt);
  const parsed = parseGeminiJson(response.text);
  let totalTokens = response.tokenCount ?? 0;

  if (!parsed.topics || !Array.isArray(parsed.topics)) {
    throw new Error("Gemini did not return a valid topics array.");
  }

  let topics = validateAndCleanTopics(parsed.topics, allowedUrls, city, seedTitle, currentYear);

  // Check for validation failures that warrant a retry
  const failures = validateTopicsStrict(topics, allowedUrls, city, seedTitle, currentYear);

  if (failures.length > 0) {
    // Retry once with fix prompt
    const fixPrompt = `The previous topic generation had these problems:
${failures.map((f) => `- ${f}`).join("\n")}

ALLOWED URLS (use ONLY these):
${allowedUrls.map((u) => `- ${u}`).join("\n")}

Previous output:
${JSON.stringify(parsed.topics, null, 2)}

Fix all issues and return the corrected JSON with the same schema.
RULES: 4-8 topics, first topic fromSeedTitle=true, titles must include "${city}", audienceFit only TRAVELLERS/TEACHERS, sourceUrls 1-3 from allowed list only, no em dashes.

Return ONLY the JSON.`;

    const retryResponse = await callGemini(fixPrompt);
    const retryParsed = parseGeminiJson(retryResponse.text);
    totalTokens += retryResponse.tokenCount ?? 0;

    if (retryParsed.topics && Array.isArray(retryParsed.topics)) {
      const retryTopics = validateAndCleanTopics(
        retryParsed.topics,
        allowedUrls,
        city,
        seedTitle,
        currentYear
      );
      if (retryTopics.length >= 4) {
        topics = retryTopics;
      }
    }
  }

  return { topics, tokenUsage: totalTokens };
}

/* ------------------------------------------------------------------ */
/*  Topic validation and cleaning                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate, clean, and normalize topics from Gemini.
 * Filters out sourceUrls not in allowedUrls.
 */
function validateAndCleanTopics(
  rawTopics: unknown[],
  allowedUrls: string[],
  city: string,
  seedTitle: string,
  currentYear: number
): NewsTopic[] {
  const allowedSet = new Set(allowedUrls.map((u) => u.replace(/\/$/, "")));
  const topics: NewsTopic[] = [];

  for (const raw of rawTopics as any[]) {
    if (!raw.id || !raw.title || !raw.angle || !raw.whyItMatters) continue;

    // Enforce audienceFit enum
    const audienceFit: AudienceFit[] = Array.isArray(raw.audienceFit)
      ? raw.audienceFit.filter((a: string) => VALID_AUDIENCE.has(a))
      : ["TRAVELLERS", "TEACHERS"];
    if (audienceFit.length === 0) audienceFit.push("TRAVELLERS", "TEACHERS");

    // Clean strings
    const title = cleanStr(String(raw.title));
    const angle = cleanStr(String(raw.angle));
    const whyItMatters = cleanStr(String(raw.whyItMatters));
    const intent = cleanStr(String(raw.intent || "informational"));

    // Filter sourceUrls to only allowed URLs
    let sourceUrls: string[] = [];
    if (Array.isArray(raw.sourceUrls)) {
      sourceUrls = raw.sourceUrls
        .map(String)
        .filter((u: string) => {
          const normalized = u.replace(/\/$/, "");
          return allowedSet.has(normalized);
        })
        .slice(0, 3);
    }
    // Deduplicate
    sourceUrls = [...new Set(sourceUrls)];

    // Validate searchQueries (3-6)
    const searchQueries: string[] = Array.isArray(raw.searchQueries)
      ? raw.searchQueries.map(String).slice(0, 6)
      : [];

    // Validate outlineAngles (3-6)
    const outlineAngles: string[] = Array.isArray(raw.outlineAngles)
      ? raw.outlineAngles.map(String).slice(0, 6)
      : [];

    topics.push({
      id: String(raw.id),
      title,
      angle,
      whyItMatters,
      audienceFit,
      suggestedKeywords: {
        target: String(raw.suggestedKeywords?.target || raw.title),
        secondary: Array.isArray(raw.suggestedKeywords?.secondary)
          ? raw.suggestedKeywords.secondary.map(String)
          : [],
      },
      searchQueries,
      intent,
      outlineAngles,
      sourceUrls,
      sourceCount: sourceUrls.length,
      fromSeedTitle: Boolean(raw.fromSeedTitle),
    });
  }

  return topics;
}

/**
 * Return a list of strict validation failures for the retry prompt.
 * If empty, topics pass validation.
 */
function validateTopicsStrict(
  topics: NewsTopic[],
  allowedUrls: string[],
  city: string,
  seedTitle: string,
  currentYear: number
): string[] {
  const failures: string[] = [];
  const allowedSet = new Set(allowedUrls.map((u) => u.replace(/\/$/, "")));
  const cityLower = city.toLowerCase();

  if (topics.length < 4 || topics.length > 8) {
    failures.push(`Expected 4-8 topics, got ${topics.length}.`);
  }

  if (topics.length > 0 && !topics[0].fromSeedTitle) {
    failures.push("First topic must have fromSeedTitle=true.");
  }

  for (const t of topics) {
    if (!t.title.toLowerCase().includes(cityLower)) {
      failures.push(`Topic "${t.title}" does not include "${city}".`);
    }

    // Check for wrong years
    if (seedTitle.includes(String(currentYear))) {
      const yearMatch = t.title.match(/\b(20\d{2})\b/);
      if (yearMatch && yearMatch[1] !== String(currentYear)) {
        failures.push(
          `Topic "${t.title}" uses year ${yearMatch[1]} instead of ${currentYear}.`
        );
      }
    }

    // Check audienceFit
    for (const af of t.audienceFit) {
      if (!VALID_AUDIENCE.has(af)) {
        failures.push(
          `Topic "${t.title}" has invalid audienceFit "${af}".`
        );
      }
    }

    // Check sourceUrls
    const urls = t.sourceUrls || [];
    if (urls.length < 1 || urls.length > 3) {
      failures.push(
        `Topic "${t.title}" has ${urls.length} sourceUrls (need 1-3).`
      );
    }
    for (const u of urls) {
      if (!allowedSet.has(u.replace(/\/$/, ""))) {
        failures.push(
          `Topic "${t.title}" cites URL not in search results: ${u}`
        );
      }
    }
    if (new Set(urls).size !== urls.length) {
      failures.push(`Topic "${t.title}" has duplicate sourceUrls.`);
    }

    // Check em dashes
    for (const field of [t.title, t.angle, t.whyItMatters, t.intent]) {
      if (hasEmDash(field)) {
        failures.push(`Em dash found in topic "${t.title}".`);
        break;
      }
    }
  }

  return failures;
}

/* ------------------------------------------------------------------ */
/*  Full pipeline orchestrator                                          */
/* ------------------------------------------------------------------ */

export interface PipelineResult {
  topics: NewsTopic[];
  log: PipelineLog;
  error?: string;
}

/**
 * Run the full 2-stage Search Topics pipeline:
 * 1. Generate search queries from seed title
 * 2. Execute web searches
 * 3. Generate topic variations grounded in results
 */
export async function runSearchTopicsPipeline(
  seedTitle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): Promise<PipelineResult> {
  const currentYear = new Date().getFullYear();
  let totalTokens = 0;

  // Stage A: Generate search queries
  console.log("[SearchTopics] Stage A: Generating search queries...");
  const { queries, tokenUsage: queryTokens } = await generateSearchQueries(
    seedTitle,
    cityFocus,
    audienceFocus,
    currentYear
  );
  totalTokens += queryTokens;
  console.log(`[SearchTopics] Generated ${queries.length} queries:`, queries);

  if (queries.length === 0) {
    return {
      topics: [],
      log: {
        seedTitle,
        queryList: [],
        usableResultCount: 0,
        totalTokenUsage: totalTokens,
        topicsCount: 0,
      },
      error: "Failed to generate search queries. Try again.",
    };
  }

  // Stage B (search): Execute web searches for each query
  console.log("[SearchTopics] Executing web searches...");
  let results = await executeSearchQueries(queries);
  console.log(`[SearchTopics] Found ${results.length} usable results.`);

  // If too few results, try widening queries
  if (results.length < MIN_USABLE_RESULTS) {
    console.log("[SearchTopics] Too few results, widening queries...");
    const city =
      cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
    const widenedQueries = [
      `${seedTitle} ${city}`,
      `Cambodia ${seedTitle.split(" ").slice(0, 3).join(" ")}`,
      `${city} latest news ${currentYear}`,
    ];
    const extraResults = await executeSearchQueries(widenedQueries);
    // Merge, dedup by URL
    const seenUrls = new Set(results.map((r) => r.url));
    for (const r of extraResults) {
      if (!seenUrls.has(r.url)) {
        results.push(r);
        seenUrls.add(r.url);
      }
    }
    console.log(
      `[SearchTopics] After widening: ${results.length} usable results.`
    );
  }

  if (results.length < MIN_USABLE_RESULTS) {
    return {
      topics: [],
      log: {
        seedTitle,
        queryList: queries,
        usableResultCount: results.length,
        totalTokenUsage: totalTokens,
        topicsCount: 0,
      },
      error: `Not enough sources found (${results.length}). Try a different title or try again later.`,
    };
  }

  // Stage B (Gemini): Generate topic variations grounded in results
  console.log("[SearchTopics] Stage B: Generating topic variations...");
  const { topics, tokenUsage: topicTokens } =
    await generateTopicVariations(
      seedTitle,
      cityFocus,
      audienceFocus,
      currentYear,
      results
    );
  totalTokens += topicTokens;
  console.log(`[SearchTopics] Generated ${topics.length} topics.`);

  const log: PipelineLog = {
    seedTitle,
    queryList: queries,
    usableResultCount: results.length,
    totalTokenUsage: totalTokens,
    topicsCount: topics.length,
  };

  return { topics, log };
}
