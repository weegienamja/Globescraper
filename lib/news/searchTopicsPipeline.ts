/**
 * 2-stage Search Topics pipeline for the Cambodia News Blog Generator.
 *
 * Stage A: generateSearchQueries – Gemini returns search queries only
 * Stage B: generateTopicVariations – Gemini returns topics grounded in fetched results
 *
 * Between stages: scored result normalization, fallback query expansion,
 * and structured logging for debuggability.
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
  snippet: string | null;
  url: string;
  publishedAt?: string | null;
  sourceName?: string | null;
  /** Quality score used for ranking (higher = better). */
  score: number;
}

export interface QueryStats {
  query: string;
  rawCount: number;
  normalizedCount: number;
  keptCount: number;
  topDomains: string[];
}

export interface RejectionCounts {
  missingUrl: number;
  missingTitle: number;
  blockedDomain: number;
  duplicateUrl: number;
  ownDomain: number;
}

export interface PipelineLog {
  seedTitle: string;
  cityFocus: string;
  audienceFocus: string;
  queryList: string[];
  queryStats: QueryStats[];
  usableResultCount: number;
  rejections: RejectionCounts;
  fallbackUsed: boolean;
  totalTokenUsage: number;
  topicsCount: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const MIN_SOURCES = 6;
const TARGET_SOURCES = 15;
const SEARCH_TIMEOUT_MS = 8_000;

const VALID_AUDIENCE = new Set<string>(["TRAVELLERS", "TEACHERS"]);

/**
 * High-trust domains that get a scoring boost.
 * Government, embassies, aviation authorities, major news outlets.
 */
const HIGH_TRUST_DOMAINS = new Set([
  "gov.kh", "gov.uk", "gov.au", "gov.sg", "state.gov",
  "iata.org", "icao.int",
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk",
  "aljazeera.com", "thediplomat.com",
  "phnompenhpost.com", "khmertimeskh.com", "cambodianess.com",
  "lonelyplanet.com",
  "immigration.gov.kh", "evisa.gov.kh", "mfaic.gov.kh",
]);

/**
 * Tracking query parameters to strip during URL canonicalization.
 */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "gclsrc", "msclkid", "dclid",
  "ref", "ref_src", "ref_url",
]);

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

/**
 * Canonicalize a URL: strip tracking params, trailing slash, www prefix.
 * Exported for unit testing.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Strip tracking params
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    // Rebuild: lowercase host, strip www, strip trailing slash
    let out = u.origin.replace(/^https?:\/\/www\./, "https://") + u.pathname;
    if (out.endsWith("/")) out = out.slice(0, -1);
    const qs = u.searchParams.toString();
    if (qs) out += `?${qs}`;
    return out;
  } catch {
    // If URL parsing fails, do minimal cleanup
    return raw.replace(/\/$/, "").replace(/^https?:\/\/www\./, "https://");
  }
}

/**
 * Extract hostname from a URL (without www prefix).
 */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Check if a hostname matches any domain in a set (exact or subdomain).
 */
function matchesDomainSet(hostname: string, domainSet: Set<string>): boolean {
  if (domainSet.has(hostname)) return true;
  for (const d of domainSet) {
    if (hostname.endsWith("." + d)) return true;
  }
  return false;
}

/**
 * Score a search result for quality ranking.
 * Higher score = more useful result.
 * Exported for unit testing.
 */
export function scoreSearchResult(
  result: { title: string; snippet: string | null; url: string },
  cityFocus: string
): number {
  let score = 0;
  const hostname = extractHostname(result.url);
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const cityLower = city.toLowerCase();

  // +3: snippet present and >= 40 chars
  if (result.snippet && result.snippet.trim().length >= 40) {
    score += 3;
  } else if (result.snippet && result.snippet.trim().length > 0) {
    // +1: snippet present but short
    score += 1;
  }

  // +2: high-trust domain
  if (matchesDomainSet(hostname, HIGH_TRUST_DOMAINS)) {
    score += 2;
  }

  // +1: title includes cityFocus or "Cambodia"
  const titleLower = result.title.toLowerCase();
  if (titleLower.includes(cityLower) || titleLower.includes("cambodia")) {
    score += 1;
  }

  // +1: snippet mentions cityFocus or "Cambodia"
  if (result.snippet) {
    const snippetLower = result.snippet.toLowerCase();
    if (snippetLower.includes(cityLower) || snippetLower.includes("cambodia")) {
      score += 1;
    }
  }

  // -2: our own domain (exclude from research)
  if (hostname === "globescraper.com" || hostname.endsWith(".globescraper.com")) {
    score -= 2;
  }

  // -1: title looks like forum spam (very short, all caps, lots of punctuation)
  if (result.title.length < 10 || /^[A-Z\s!?]{10,}$/.test(result.title)) {
    score -= 1;
  }

  return score;
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

interface RawSearchData {
  results: SearchResult[];
  queryStats: QueryStats[];
  rejections: RejectionCounts;
}

/**
 * Execute web searches for each query via Google CSE.
 * Normalizes defensively (keeps results even without snippet).
 * Scores and ranks results, keeping top TARGET_SOURCES.
 */
export async function executeSearchQueries(
  queries: string[],
  cityFocus: CityFocus | string
): Promise<RawSearchData> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  const rejections: RejectionCounts = {
    missingUrl: 0,
    missingTitle: 0,
    blockedDomain: 0,
    duplicateUrl: 0,
    ownDomain: 0,
  };
  const queryStats: QueryStats[] = [];

  if (!apiKey || !cseId) {
    console.warn(
      "[SearchTopics] Google CSE not configured (GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID missing)"
    );
    return { results: [], queryStats, rejections };
  }

  const seenCanonical = new Set<string>();
  const allResults: SearchResult[] = [];
  let resultId = 0;

  for (const query of queries) {
    let rawCount = 0;
    let normalizedCount = 0;
    let keptCount = 0;
    const domainsForQuery: string[] = [];

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

      if (!response.ok) {
        console.warn(
          `[SearchTopics] CSE query "${query}" returned HTTP ${response.status}`
        );
        queryStats.push({
          query,
          rawCount: 0,
          normalizedCount: 0,
          keptCount: 0,
          topDomains: [],
        });
        continue;
      }
      const data = await response.json();
      const items = data.items || [];
      rawCount = items.length;

      for (const item of items) {
        const url: string | undefined = item.link;
        const title: string | undefined = item.title;

        // Must have URL
        if (!url) {
          rejections.missingUrl++;
          continue;
        }

        // Must have title
        if (!title || title.trim().length === 0) {
          rejections.missingTitle++;
          continue;
        }

        normalizedCount++;
        const canonical = canonicalizeUrl(url);
        const hostname = extractHostname(url);

        // Dedup by canonical URL
        if (seenCanonical.has(canonical)) {
          rejections.duplicateUrl++;
          continue;
        }

        // Blocked domain
        if (isBlockedDomain(url)) {
          rejections.blockedDomain++;
          continue;
        }

        // Skip our own domain — we don't want to cite ourselves
        if (hostname === "globescraper.com" || hostname.endsWith(".globescraper.com")) {
          rejections.ownDomain++;
          continue;
        }

        seenCanonical.add(canonical);
        domainsForQuery.push(hostname);
        resultId++;

        const snippet: string | null =
          item.snippet && item.snippet.trim().length > 0
            ? item.snippet.trim()
            : null;

        const trusted = findTrustedSource(url);

        const result: SearchResult = {
          id: `r${resultId}`,
          query,
          title: title.trim(),
          snippet,
          url,
          publishedAt:
            item.pagemap?.metatags?.[0]?.["article:published_time"] || null,
          sourceName: trusted?.publisher || item.displayLink || null,
          score: 0,
        };

        result.score = scoreSearchResult(result, cityFocus);
        allResults.push(result);
        keptCount++;
      }
    } catch (err) {
      console.warn(`[SearchTopics] CSE query "${query}" failed:`, err);
    }

    queryStats.push({
      query,
      rawCount,
      normalizedCount,
      keptCount,
      topDomains: [...new Set(domainsForQuery)].slice(0, 5),
    });
  }

  // Sort by score descending, keep top TARGET_SOURCES
  allResults.sort((a, b) => b.score - a.score);
  const kept = allResults.slice(0, TARGET_SOURCES);

  return { results: kept, queryStats, rejections };
}

/* ------------------------------------------------------------------ */
/*  Fallback query expansion                                            */
/* ------------------------------------------------------------------ */

/**
 * Generate fallback queries when the initial search yields too few results.
 * These are code-generated (no Gemini call), broader but still specific.
 * Exported for unit testing.
 */
export function buildFallbackQueries(
  seedTitle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus,
  originalQueries: string[]
): string[] {
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const titleWords = seedTitle
    .replace(/\b\d{4}\b/g, "") // strip years
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);

  const fallback: string[] = [];

  // a) Broader topic queries without year constraint
  if (titleWords.length >= 2) {
    fallback.push(`${city} ${titleWords.join(" ")}`);
    fallback.push(`Cambodia ${titleWords.slice(0, 3).join(" ")}`);
  }

  // b) Audience-specific queries
  if (audienceFocus === "teachers" || audienceFocus === "both") {
    fallback.push(`${city} work permit requirements teacher`);
    fallback.push(`Cambodia visa types for working as teacher`);
    fallback.push(`Cambodia immigration rules entry requirements`);
  }
  if (audienceFocus === "travellers" || audienceFocus === "both") {
    fallback.push(`${city} entry requirements visitors`);
    fallback.push(`Cambodia e-visa vs ordinary visa`);
    fallback.push(`Cambodia travel requirements tourists`);
  }

  // c) Authoritative-source queries
  fallback.push(`site:gov.kh entry requirements Cambodia`);
  fallback.push(`Cambodia embassy visa requirements`);
  fallback.push(`UK FCDO Cambodia entry requirements`);

  // Dedupe against original queries (case-insensitive)
  const originalLower = new Set(originalQueries.map((q) => q.toLowerCase()));
  return fallback.filter((q) => !originalLower.has(q.toLowerCase()));
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

  // Build result list for prompt — omit snippet if null (never emit "No snippet")
  const resultsList = results
    .map((r) => {
      const parts = [`[${r.id}] "${r.title}"`];
      if (r.snippet) parts.push(r.snippet);
      parts.push(`(URL: ${r.url})`);
      if (r.publishedAt) parts.push(`Published: ${r.publishedAt}`);
      if (r.sourceName) parts.push(`Source: ${r.sourceName}`);
      return parts.join(" | ");
    })
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
  const allowedSet = new Set(allowedUrls.map((u) => canonicalizeUrl(u)));
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

    // Filter sourceUrls to only allowed URLs (canonicalize for comparison)
    let sourceUrls: string[] = [];
    if (Array.isArray(raw.sourceUrls)) {
      sourceUrls = raw.sourceUrls
        .map(String)
        .filter((u: string) => {
          const canon = canonicalizeUrl(u);
          return allowedSet.has(canon);
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
  const allowedSet = new Set(allowedUrls.map((u) => canonicalizeUrl(u)));
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
      if (!allowedSet.has(canonicalizeUrl(u))) {
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
 * 2. Execute web searches (with fallback expansion if needed)
 * 3. Generate topic variations grounded in results
 */
export async function runSearchTopicsPipeline(
  seedTitle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): Promise<PipelineResult> {
  const currentYear = new Date().getFullYear();
  let totalTokens = 0;
  let fallbackUsed = false;

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
        cityFocus,
        audienceFocus,
        queryList: [],
        queryStats: [],
        usableResultCount: 0,
        rejections: { missingUrl: 0, missingTitle: 0, blockedDomain: 0, duplicateUrl: 0, ownDomain: 0 },
        fallbackUsed: false,
        totalTokenUsage: totalTokens,
        topicsCount: 0,
      },
      error: "Failed to generate search queries. Try again.",
    };
  }

  // Primary search pass
  console.log("[SearchTopics] Primary search pass...");
  let searchData = await executeSearchQueries(queries, cityFocus);
  let allResults = searchData.results;
  let allQueryStats = searchData.queryStats;
  let allRejections = searchData.rejections;
  console.log(
    `[SearchTopics] Primary pass: ${allResults.length} results. Rejections:`,
    JSON.stringify(allRejections)
  );

  // Fallback query expansion if needed
  if (allResults.length < MIN_SOURCES) {
    fallbackUsed = true;
    console.log(
      `[SearchTopics] Only ${allResults.length} results (need ${MIN_SOURCES}). Running fallback search...`
    );
    const fallbackQueries = buildFallbackQueries(
      seedTitle,
      cityFocus,
      audienceFocus,
      queries
    );
    console.log(
      `[SearchTopics] Fallback queries (${fallbackQueries.length}):`,
      fallbackQueries.slice(0, 6)
    );

    if (fallbackQueries.length > 0) {
      const fallbackData = await executeSearchQueries(
        fallbackQueries.slice(0, 6),
        cityFocus
      );

      // Merge, dedup by canonical URL
      const seenCanonical = new Set(
        allResults.map((r) => canonicalizeUrl(r.url))
      );
      for (const r of fallbackData.results) {
        const canon = canonicalizeUrl(r.url);
        if (!seenCanonical.has(canon)) {
          allResults.push(r);
          seenCanonical.add(canon);
        }
      }

      // Merge stats
      allQueryStats = [...allQueryStats, ...fallbackData.queryStats];
      allRejections = {
        missingUrl: allRejections.missingUrl + fallbackData.rejections.missingUrl,
        missingTitle: allRejections.missingTitle + fallbackData.rejections.missingTitle,
        blockedDomain: allRejections.blockedDomain + fallbackData.rejections.blockedDomain,
        duplicateUrl: allRejections.duplicateUrl + fallbackData.rejections.duplicateUrl,
        ownDomain: allRejections.ownDomain + fallbackData.rejections.ownDomain,
      };

      // Re-sort by score, cap at TARGET_SOURCES
      allResults.sort((a, b) => b.score - a.score);
      allResults = allResults.slice(0, TARGET_SOURCES);

      console.log(
        `[SearchTopics] After fallback: ${allResults.length} total results.`
      );
    }
  }

  // Build the log
  const log: PipelineLog = {
    seedTitle,
    cityFocus,
    audienceFocus,
    queryList: queries,
    queryStats: allQueryStats,
    usableResultCount: allResults.length,
    rejections: allRejections,
    fallbackUsed,
    totalTokenUsage: totalTokens,
    topicsCount: 0,
  };

  if (allResults.length === 0) {
    log.totalTokenUsage = totalTokens;
    return {
      topics: [],
      log,
      error:
        "No usable sources returned from search. Try again, or pick a less niche title.",
    };
  }

  // Even if below MIN_SOURCES, proceed with what we have (>0) rather than failing.
  if (allResults.length < MIN_SOURCES) {
    console.warn(
      `[SearchTopics] Proceeding with ${allResults.length} results (below MIN_SOURCES=${MIN_SOURCES}).`
    );
  }

  // Stage B (Gemini): Generate topic variations grounded in results
  console.log(
    `[SearchTopics] Stage B: Generating topic variations from ${allResults.length} results...`
  );
  const { topics, tokenUsage: topicTokens } =
    await generateTopicVariations(
      seedTitle,
      cityFocus,
      audienceFocus,
      currentYear,
      allResults
    );
  totalTokens += topicTokens;
  console.log(`[SearchTopics] Generated ${topics.length} topics.`);

  log.totalTokenUsage = totalTokens;
  log.topicsCount = topics.length;

  return { topics, log };
}
