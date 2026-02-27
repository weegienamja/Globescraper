/**
 * Search Topics pipeline for the Cambodia News Blog Generator.
 *
 * Stable query generation from backend inputs (no LLM for queries).
 * Priority-ordered search with early stopping.
 * Multi-round fallback with graceful degradation.
 * Gemini used only for Stage B: topic variation generation.
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

/* ================================================================== */
/*  Public types                                                        */
/* ================================================================== */

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
  group: string;
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

export interface QueryPack {
  /** Flattened queries in priority order: base → authority → broad → titleHint */
  queries: string[];
  strategy: {
    base: string[];
    authority: string[];
    broad: string[];
    titleHint: string[];
  };
}

export interface PipelineLog {
  seedTitle: string;
  cityFocus: string;
  audienceFocus: string;
  selectedGapTopic: string | null;
  queryPack: QueryPack["strategy"];
  queryList: string[];
  queryStats: QueryStats[];
  groupsExecuted: string[];
  usableResultCount: number;
  rejections: RejectionCounts;
  fallbackRoundsUsed: number;
  totalTokenUsage: number;
  topicsCount: number;
}

export interface PipelineResult {
  topics: NewsTopic[];
  log: PipelineLog;
  /** Soft warnings (low/no sources). Technical failures throw instead. */
  diagnostics?: {
    warning?: string;
  };
}

/* ================================================================== */
/*  Constants                                                           */
/* ================================================================== */

const MIN_SOURCES = 6;
const TARGET_SOURCES = 15;
const SEARCH_TIMEOUT_MS = 8_000;

const VALID_AUDIENCE = new Set<string>(["TRAVELLERS", "TEACHERS"]);

/**
 * High-trust domains that get a scoring boost.
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
 * Tracking query parameters stripped during URL canonicalization.
 */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "gclsrc", "msclkid", "dclid",
  "ref", "ref_src", "ref_url",
]);

/* ================================================================== */
/*  Authority query templates by gap topic                              */
/* ================================================================== */

const AUTHORITY_QUERIES_MAP: Record<string, (city: string, yr: number) => string[]> = {
  safety: (city, yr) => [
    "FCDO Cambodia travel advice",
    "US State Department Cambodia travel advisory",
  ],
  scams: (city, yr) => [
    "FCDO Cambodia travel advice scams",
    "Cambodia tourist scams police warning",
  ],
  visa: (city, yr) => [
    "Cambodia e-visa official gov.kh",
    `Cambodia visa requirements ${yr}`,
  ],
  entry: (city, yr) => [
    "Cambodia entry requirements official",
    `Cambodia immigration rules ${yr}`,
  ],
  healthcare: (city, yr) => [
    `hospitals ${city} international clinic foreigners`,
    `healthcare Cambodia expats ${yr}`,
  ],
  renting: (city, yr) => [
    `renting apartment ${city} foreigners deposit`,
    `${city} rental contract tips`,
  ],
  transport: (city, yr) => [
    `${city} transport options foreigners`,
    `PassApp Grab ${city} ride hailing`,
  ],
  airport: (city, yr) => [
    "Phnom Penh International Airport PNH arrivals guide",
    `Cambodia airports ${yr}`,
  ],
  flight: (city, yr) => [
    `flights to ${city} airlines routes`,
    `Cambodia airport airlines ${yr}`,
  ],
  SIM: (city, yr) => [
    `SIM card Cambodia tourist prepaid ${yr}`,
    "Cellcard Smart Metfone Cambodia prepaid",
  ],
  banking: (city, yr) => [
    "ATM Cambodia foreigners fees withdrawals",
    `banking ${city} expats accounts`,
  ],
  "cost of living": (city, yr) => [
    `cost of living ${city} ${yr} expats`,
    `monthly budget ${city} foreigners`,
  ],
  teaching: (city, yr) => [
    `TEFL jobs Cambodia ${yr} salary`,
    `teaching English ${city} requirements`,
  ],
  food: (city, yr) => [
    `street food ${city} safe hygiene`,
    `best restaurants ${city} foreigners`,
  ],
  coworking: (city, yr) => [
    `coworking spaces ${city} ${yr}`,
    `digital nomad ${city} remote work`,
  ],
};

/* ================================================================== */
/*  Noise words filtered from title keyword extraction                  */
/* ================================================================== */

const TITLE_NOISE_WORDS = new Set([
  "a", "an", "the", "in", "of", "to", "for", "and", "or", "is", "are",
  "your", "our", "this", "that", "its", "be", "was", "were", "been",
  "guide", "guides", "essential", "complete", "ultimate", "best",
  "top", "tips", "things", "know", "need", "how", "what", "why", "when",
  "living", "visiting", "moving", "traveling", "travelling", "about",
  "new", "every", "all", "most", "should", "will", "can", "must",
  "cambodia", "phnom", "penh", "siem", "reap",
]);

/* ================================================================== */
/*  Keyword → topic inference table                                     */
/* ================================================================== */

const TOPIC_KEYWORDS: [string, string[]][] = [
  ["visa", ["visa", "e-visa", "evisa"]],
  ["entry", ["entry", "immigration", "border", "arriving"]],
  ["scams", ["scam", "fraud", "con artist", "rip-off", "ripoff"]],
  ["safety", ["safety", "safe", "danger", "crime", "security"]],
  ["healthcare", ["health", "hospital", "clinic", "medical", "doctor"]],
  ["renting", ["rent", "apartment", "housing", "landlord", "flat"]],
  ["transport", ["transport", "tuk tuk", "tuktuk", "taxi", "bus", "getting around"]],
  ["airport", ["airport", "terminal", "arrivals", "landing"]],
  ["flight", ["flight", "airline", "flying", "cheap flights"]],
  ["SIM", ["sim card", "sim", "mobile phone", "phone plan", "data plan"]],
  ["banking", ["bank", "atm", "money", "currency", "exchange"]],
  ["cost of living", ["cost of living", "budget", "expense", "afford", "cheap"]],
  ["teaching", ["teach", "tefl", "english teacher", "esl", "tesol"]],
  ["food", ["food", "restaurant", "eating", "cuisine", "street food"]],
  ["coworking", ["coworking", "co-working", "digital nomad", "remote work", "freelance"]],
];

/* ================================================================== */
/*  Helpers                                                             */
/* ================================================================== */

function cleanStr(s: string): string {
  return s.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");
}

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
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    let out = u.origin.replace(/^https?:\/\/www\./, "https://") + u.pathname;
    if (out.endsWith("/")) out = out.slice(0, -1);
    const qs = u.searchParams.toString();
    if (qs) out += `?${qs}`;
    return out;
  } catch {
    return raw.replace(/\/$/, "").replace(/^https?:\/\/www\./, "https://");
  }
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

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

  // -2: our own domain
  if (hostname === "globescraper.com" || hostname.endsWith(".globescraper.com")) {
    score -= 2;
  }

  // -1: spam-like title
  if (result.title.length < 10 || /^[A-Z\s!?]{10,}$/.test(result.title)) {
    score -= 1;
  }

  return score;
}

function emptyRejections(): RejectionCounts {
  return { missingUrl: 0, missingTitle: 0, blockedDomain: 0, duplicateUrl: 0, ownDomain: 0 };
}

function mergeRejections(a: RejectionCounts, b: RejectionCounts): RejectionCounts {
  return {
    missingUrl: a.missingUrl + b.missingUrl,
    missingTitle: a.missingTitle + b.missingTitle,
    blockedDomain: a.blockedDomain + b.blockedDomain,
    duplicateUrl: a.duplicateUrl + b.duplicateUrl,
    ownDomain: a.ownDomain + b.ownDomain,
  };
}

/* ================================================================== */
/*  Title keyword extraction + topic inference                          */
/* ================================================================== */

/**
 * Extract 1-3 meaningful keywords from a title for a supplementary query.
 * Strips noise words, years, city names, and generic terms.
 * Exported for unit testing.
 */
export function extractTitleKeywords(title: string): string[] {
  const words = title
    .replace(/\b\d{4}\b/g, "")
    .replace(/[^\w\s'-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TITLE_NOISE_WORDS.has(w));
  return [...new Set(words)].slice(0, 3);
}

/**
 * Infer the most likely gap topic from a title via keyword matching.
 * Falls back to "travel" if nothing matches.
 * Exported for unit testing.
 */
export function inferTopicFromTitle(title: string): string {
  const lower = title.toLowerCase();
  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return topic;
    }
  }
  return "travel";
}

/* ================================================================== */
/*  Deterministic query pack builder (no LLM)                           */
/* ================================================================== */

/**
 * Build a search query pack from stable backend inputs.
 * The title is a weak optional hint — queries are driven by
 * selectedGapTopic + primaryKeywordPhrase.
 * Exported for unit testing.
 */
export function buildSearchQueryPack({
  cityFocus,
  audienceFocus,
  selectedGapTopic,
  primaryKeywordPhrase,
  currentYear,
  titleHint,
}: {
  cityFocus: CityFocus;
  audienceFocus: AudienceFocus;
  selectedGapTopic?: string;
  primaryKeywordPhrase?: string;
  currentYear: number;
  titleHint?: string;
}): QueryPack {
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const topic = selectedGapTopic || inferTopicFromTitle(titleHint || "");
  const keyword = primaryKeywordPhrase || topic;
  const audienceLabel =
    audienceFocus === "teachers"
      ? "teachers"
      : audienceFocus === "travellers"
        ? "travellers"
        : "expats";

  // ── Base queries (2-3): topic + keyword + city ──
  const base: string[] = [
    `${keyword} ${city} ${currentYear}`,
    `${topic} ${city} ${audienceLabel}`,
  ];
  if (city !== "Cambodia") {
    base.push(`${topic} Cambodia ${city}`);
  }

  // ── Authority queries (1-2): stable authoritative sources ──
  const authorityFn = AUTHORITY_QUERIES_MAP[topic];
  const authority: string[] = authorityFn
    ? authorityFn(city, currentYear)
    : [`${topic} Cambodia official`, `Cambodia ${topic} advice ${currentYear}`];

  // ── Broad queries (1-2): ignore audience ──
  const broad: string[] = [
    `${city} ${topic} tips`,
    `${topic} Cambodia foreigners`,
  ];

  // ── Title hint (0-1): low priority, only if it adds value ──
  const titleHintQueries: string[] = [];
  if (titleHint) {
    const keywords = extractTitleKeywords(titleHint);
    if (keywords.length > 0) {
      titleHintQueries.push(`${keywords.join(" ")} ${city}`);
    }
  }

  const queries = [...base, ...authority, ...broad, ...titleHintQueries];

  return {
    queries,
    strategy: { base, authority, broad, titleHint: titleHintQueries },
  };
}

/* ================================================================== */
/*  CSE fetch — executes a batch of queries against Google CSE          */
/* ================================================================== */

interface SearchGroupResult {
  results: SearchResult[];
  queryStats: QueryStats[];
  rejections: RejectionCounts;
  nextResultId: number;
}

/**
 * Execute a batch of Google CSE queries.
 * Deduplicates against seenCanonical (mutated in-place).
 * No date restriction — relevance-sorted for maximum result coverage.
 */
async function executeSearchGroup(
  queries: string[],
  groupName: string,
  cityFocus: string,
  seenCanonical: Set<string>,
  startResultId: number
): Promise<SearchGroupResult> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  const rejections = emptyRejections();
  const queryStats: QueryStats[] = [];
  const results: SearchResult[] = [];
  let resultId = startResultId;

  if (!apiKey || !cseId) {
    console.warn("[SearchTopics] Google CSE not configured");
    return { results, queryStats, rejections, nextResultId: resultId };
  }

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
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[SearchTopics] CSE "${query}" HTTP ${response.status}`);
        queryStats.push({
          query,
          group: groupName,
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

        // Blocked domain (social media, forums)
        if (isBlockedDomain(url)) {
          rejections.blockedDomain++;
          continue;
        }

        // Skip our own domain
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
        results.push(result);
        keptCount++;
      }
    } catch (err) {
      console.warn(`[SearchTopics] CSE "${query}" failed:`, err);
    }

    queryStats.push({
      query,
      group: groupName,
      rawCount,
      normalizedCount,
      keptCount,
      topDomains: [...new Set(domainsForQuery)].slice(0, 5),
    });
  }

  return { results, queryStats, rejections, nextResultId: resultId };
}

/* ================================================================== */
/*  Priority-ordered search execution with early stopping               */
/* ================================================================== */

interface RawSearchData {
  results: SearchResult[];
  queryStats: QueryStats[];
  rejections: RejectionCounts;
  groupsExecuted: string[];
}

/**
 * Execute query pack groups in priority order:
 *   base → authority → broad → titleHint
 * Stops early once usable results >= MIN_SOURCES.
 */
export async function executeSearchWithPriority(
  queryPack: QueryPack,
  cityFocus: CityFocus
): Promise<RawSearchData> {
  const seenCanonical = new Set<string>();
  let allResults: SearchResult[] = [];
  let allQueryStats: QueryStats[] = [];
  let totalRejections = emptyRejections();
  let resultId = 0;
  const groupsExecuted: string[] = [];

  const groups: { name: string; queries: string[] }[] = [
    { name: "base", queries: queryPack.strategy.base },
    { name: "authority", queries: queryPack.strategy.authority },
    { name: "broad", queries: queryPack.strategy.broad },
    { name: "titleHint", queries: queryPack.strategy.titleHint },
  ];

  for (const group of groups) {
    if (group.queries.length === 0) continue;

    const { results, queryStats, rejections, nextResultId } =
      await executeSearchGroup(
        group.queries,
        group.name,
        cityFocus,
        seenCanonical,
        resultId
      );

    allResults.push(...results);
    allQueryStats.push(...queryStats);
    totalRejections = mergeRejections(totalRejections, rejections);
    resultId = nextResultId;
    groupsExecuted.push(group.name);

    // Early stopping: enough usable sources
    if (allResults.length >= MIN_SOURCES) {
      console.log(
        `[SearchTopics] Early stop after "${group.name}": ${allResults.length} results`
      );
      break;
    }
  }

  // Sort by score descending, keep top TARGET_SOURCES
  allResults.sort((a, b) => b.score - a.score);
  allResults = allResults.slice(0, TARGET_SOURCES);

  return {
    results: allResults,
    queryStats: allQueryStats,
    rejections: totalRejections,
    groupsExecuted,
  };
}

/* ================================================================== */
/*  Fallback rounds (no title changes, no LLM)                         */
/* ================================================================== */

/**
 * Build fallback queries for a given round, deduplicating against existing queries.
 *
 * Round 1: Replace audience-specific terms with broader ones, drop year.
 * Round 2: Reduce to core topic words, remove adjectives.
 * Round 3: Generic "Cambodia + topic" queries (no city).
 *
 * Exported for unit testing.
 */
export function buildFallbackRound(
  round: 1 | 2 | 3,
  topic: string,
  city: string,
  audienceFocus: AudienceFocus,
  existingQueries: string[]
): string[] {
  const existing = new Set(existingQueries.map((q) => q.toLowerCase()));
  let queries: string[] = [];

  if (round === 1) {
    // Broader audience terms, no year
    const audience =
      audienceFocus === "teachers"
        ? "expats"
        : audienceFocus === "travellers"
          ? "visitors"
          : "foreigners";
    queries = [
      `${topic} ${city} ${audience}`,
      `${topic} Cambodia ${audience}`,
      `${city} ${topic} information`,
    ];
  } else if (round === 2) {
    // Core words only, strip adjectives
    const core = topic
      .replace(
        /\b(essential|best|current|complete|ultimate|top|latest|new)\b/gi,
        ""
      )
      .trim();
    queries = [`${core} ${city}`, `${core} Cambodia guide`];
  } else {
    // Generic Cambodia + topic (no city)
    queries = [
      `Cambodia ${topic}`,
      `Cambodia ${topic} tourists`,
      `Cambodia ${topic} information`,
    ];
  }

  return queries.filter((q) => !existing.has(q.toLowerCase()));
}

/* ================================================================== */
/*  Stage B: Generate Topic Variations (Gemini)                         */
/* ================================================================== */

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

  // Build result list for prompt — omit snippet if null
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

  let topics = validateAndCleanTopics(
    parsed.topics,
    allowedUrls,
    city,
    seedTitle,
    currentYear
  );

  // Check for validation failures that warrant a retry
  const failures = validateTopicsStrict(
    topics,
    allowedUrls,
    city,
    seedTitle,
    currentYear
  );

  if (failures.length > 0) {
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

/* ================================================================== */
/*  Topic validation and cleaning                                       */
/* ================================================================== */

function validateAndCleanTopics(
  rawTopics: unknown[],
  allowedUrls: string[],
  city: string,
  seedTitle: string,
  currentYear: number
): NewsTopic[] {
  const allowedSet = new Set(allowedUrls.map((u) => canonicalizeUrl(u)));
  const topics: NewsTopic[] = [];

  for (const raw of rawTopics as Record<string, unknown>[]) {
    if (!raw.id || !raw.title || !raw.angle || !raw.whyItMatters) continue;

    const audienceFit: AudienceFit[] = Array.isArray(raw.audienceFit)
      ? (raw.audienceFit as string[]).filter((a) => VALID_AUDIENCE.has(a)) as AudienceFit[]
      : ["TRAVELLERS", "TEACHERS"];
    if (audienceFit.length === 0) audienceFit.push("TRAVELLERS", "TEACHERS");

    const title = cleanStr(String(raw.title));
    const angle = cleanStr(String(raw.angle));
    const whyItMatters = cleanStr(String(raw.whyItMatters));
    const intent = cleanStr(String(raw.intent || "informational"));

    let sourceUrls: string[] = [];
    if (Array.isArray(raw.sourceUrls)) {
      sourceUrls = (raw.sourceUrls as string[])
        .map(String)
        .filter((u) => allowedSet.has(canonicalizeUrl(u)))
        .slice(0, 3);
    }
    sourceUrls = [...new Set(sourceUrls)];

    const searchQueries: string[] = Array.isArray(raw.searchQueries)
      ? (raw.searchQueries as string[]).map(String).slice(0, 6)
      : [];

    const outlineAngles: string[] = Array.isArray(raw.outlineAngles)
      ? (raw.outlineAngles as string[]).map(String).slice(0, 6)
      : [];

    const suggestedKeywords = raw.suggestedKeywords as
      | { target?: string; secondary?: string[] }
      | undefined;

    topics.push({
      id: String(raw.id),
      title,
      angle,
      whyItMatters,
      audienceFit,
      suggestedKeywords: {
        target: String(suggestedKeywords?.target || raw.title),
        secondary: Array.isArray(suggestedKeywords?.secondary)
          ? suggestedKeywords!.secondary!.map(String)
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

    if (seedTitle.includes(String(currentYear))) {
      const yearMatch = t.title.match(/\b(20\d{2})\b/);
      if (yearMatch && yearMatch[1] !== String(currentYear)) {
        failures.push(
          `Topic "${t.title}" uses year ${yearMatch[1]} instead of ${currentYear}.`
        );
      }
    }

    for (const af of t.audienceFit) {
      if (!VALID_AUDIENCE.has(af)) {
        failures.push(`Topic "${t.title}" has invalid audienceFit "${af}".`);
      }
    }

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

    for (const field of [t.title, t.angle, t.whyItMatters, t.intent]) {
      if (hasEmDash(field)) {
        failures.push(`Em dash found in topic "${t.title}".`);
        break;
      }
    }
  }

  return failures;
}

/* ================================================================== */
/*  Full pipeline orchestrator                                          */
/* ================================================================== */

/**
 * Run the Search Topics pipeline:
 * 1. Build deterministic query pack from stable inputs (no LLM)
 * 2. Priority-ordered search with early stopping
 * 3. Multi-round fallback if needed
 * 4. Generate topic variations via Gemini (Stage B)
 *
 * Returns warnings instead of hard errors for "not enough sources".
 * Only throws for actual technical failures (API errors, Gemini failures).
 */
export async function runSearchTopicsPipeline(
  seedTitle: string,
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus,
  selectedGapTopic?: string,
  primaryKeywordPhrase?: string
): Promise<PipelineResult> {
  const currentYear = new Date().getFullYear();
  let totalTokens = 0;
  const topic = selectedGapTopic || inferTopicFromTitle(seedTitle);
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;

  // 1. Build query pack (deterministic, no LLM)
  console.log(
    `[SearchTopics] Building query pack: topic="${topic}", keyword="${primaryKeywordPhrase || topic}"`
  );
  const queryPack = buildSearchQueryPack({
    cityFocus,
    audienceFocus,
    selectedGapTopic,
    primaryKeywordPhrase,
    currentYear,
    titleHint: seedTitle,
  });
  const activeGroups = Object.entries(queryPack.strategy).filter(
    ([, v]) => v.length > 0
  ).length;
  console.log(
    `[SearchTopics] Query pack: ${queryPack.queries.length} queries across ${activeGroups} groups`
  );

  // 2. Priority-ordered search with early stopping
  const searchData = await executeSearchWithPriority(queryPack, cityFocus);
  let allResults = searchData.results;
  let allQueryStats = searchData.queryStats;
  let allRejections = searchData.rejections;
  let fallbackRoundsUsed = 0;
  const allQueriesUsed = [...queryPack.queries];

  console.log(
    `[SearchTopics] Primary: ${allResults.length} results, groups: [${searchData.groupsExecuted.join(", ")}]`
  );

  // 3. Fallback rounds (no title changes, no LLM)
  if (allResults.length < MIN_SOURCES) {
    const seenCanonical = new Set(
      allResults.map((r) => canonicalizeUrl(r.url))
    );

    for (let round = 1; round <= 3; round++) {
      if (allResults.length >= MIN_SOURCES) break;

      const fbQueries = buildFallbackRound(
        round as 1 | 2 | 3,
        topic,
        city,
        audienceFocus,
        allQueriesUsed
      );
      if (fbQueries.length === 0) continue;

      fallbackRoundsUsed = round;
      allQueriesUsed.push(...fbQueries);
      console.log(
        `[SearchTopics] Fallback round ${round}: ${fbQueries.join(", ")}`
      );

      const { results, queryStats, rejections } = await executeSearchGroup(
        fbQueries,
        `fallback-${round}`,
        cityFocus,
        seenCanonical,
        allResults.length
      );

      allResults.push(...results);
      allQueryStats.push(...queryStats);
      allRejections = mergeRejections(allRejections, rejections);
    }

    // Re-sort and cap
    allResults.sort((a, b) => b.score - a.score);
    allResults = allResults.slice(0, TARGET_SOURCES);
    console.log(
      `[SearchTopics] After fallbacks: ${allResults.length} results`
    );
  }

  // 4. Build pipeline log
  const log: PipelineLog = {
    seedTitle,
    cityFocus,
    audienceFocus,
    selectedGapTopic: selectedGapTopic || null,
    queryPack: queryPack.strategy,
    queryList: allQueriesUsed,
    queryStats: allQueryStats,
    groupsExecuted: searchData.groupsExecuted,
    usableResultCount: allResults.length,
    rejections: allRejections,
    fallbackRoundsUsed,
    totalTokenUsage: totalTokens,
    topicsCount: 0,
  };

  // 5. Zero results → return warning (not error)
  if (allResults.length === 0) {
    return {
      topics: [],
      log,
      diagnostics: {
        warning:
          "No usable sources found. The topic may be too niche. Try a broader city or audience.",
      },
    };
  }

  // 6. Proceed even with low results — attach warning if below threshold
  const lowSources = allResults.length < MIN_SOURCES;
  if (lowSources) {
    console.warn(
      `[SearchTopics] Proceeding with ${allResults.length}/${MIN_SOURCES} results.`
    );
  }

  // 7. Stage B: Generate topic variations (Gemini)
  console.log(
    `[SearchTopics] Stage B: Generating topics from ${allResults.length} sources...`
  );

  const { topics, tokenUsage: topicTokens } = await generateTopicVariations(
    seedTitle,
    cityFocus,
    audienceFocus,
    currentYear,
    allResults
  );
  totalTokens += topicTokens;
  log.totalTokenUsage = totalTokens;
  log.topicsCount = topics.length;

  console.log(
    `[SearchTopics] Done: ${topics.length} topics, ${totalTokens} tokens`
  );

  // 8. Attach low-source warning if applicable
  const result: PipelineResult = { topics, log };
  if (lowSources) {
    result.diagnostics = {
      warning:
        "Low source count. Topics may be less well-grounded. Try a broader city or audience.",
    };
  }

  return result;
}
