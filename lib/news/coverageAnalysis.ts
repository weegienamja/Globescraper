/**
 * Coverage analysis for the Cambodia News Blog Generator.
 *
 * Scans existing GlobeScraper posts and AI drafts, maps covered intents,
 * identifies gaps, and uses Gemini to produce a unique candidate title for "Generate Title".
 */

import { prisma } from "@/lib/prisma";
import { getPostsMeta } from "@/lib/content";
import { callGeminiWithSchema } from "@/lib/ai/geminiClient";
import { z } from "zod";
import type { CityFocus, AudienceFocus } from "@/lib/newsTopicTypes";

/* ------------------------------------------------------------------ */
/*  Intent vocabulary                                                   */
/* ------------------------------------------------------------------ */

export const INTENT_VOCABULARY = [
  "visa", "e-visa", "evisa", "border", "entry", "passport", "immigration",
  "transport", "airport", "bus", "tuk-tuk", "taxi", "grab", "flight",
  "safety", "scams", "crime", "police",
  "healthcare", "hospital", "pharmacy", "insurance", "dentist",
  "SIM", "sim card", "mobile", "internet", "wifi",
  "banking", "ATM", "money", "exchange", "currency",
  "renting", "apartment", "housing", "deposit", "lease", "landlord",
  "cost of living", "budget", "prices", "inflation", "fees",
  "teaching", "TEFL", "school", "salary", "hiring", "work permit",
  "neighbourhood", "neighborhood", "area", "district",
  "food", "restaurant", "street food", "market",
  "nightlife", "bar", "entertainment",
  "coworking", "digital nomad", "remote work", "freelance",
  "festival", "event", "holiday", "khmer new year",
  "weather", "climate", "rainy season", "dry season",
  "language", "khmer", "learning",
  "shipping", "mail", "package",
  "pet", "animal", "veterinary",
  "gym", "fitness", "sport",
  "temple", "angkor", "sightseeing", "tour",
] as const;

/** The subset of intents that tend to be time-sensitive (news-worthy). */
export const FRESHNESS_INTENTS = [
  "visa", "e-visa", "evisa", "border", "entry", "immigration",
  "transport", "airport", "flight",
  "safety", "scams",
  "healthcare",
  "cost of living", "prices", "inflation", "fees",
  "teaching", "salary", "hiring", "work permit",
  "festival", "event",
] as const;

/* ------------------------------------------------------------------ */
/*  Coverage map types                                                  */
/* ------------------------------------------------------------------ */

export interface CoverageEntry {
  slug: string;
  title: string;
  intents: string[];
  cities: string[];
  audiences: string[];
  source: "static" | "ai_published" | "ai_draft";
  createdAt?: Date;
}

export interface CoverageGap {
  intent: string;
  isFreshnessRelevant: boolean;
  coverageCount: number;
  lastCoveredAt?: Date;
  staleness: number; // 0-10, higher = more stale
}

export interface CandidateTitle {
  title: string;
  score: number;
  why: string[];
  keywords: string[];
  intent: string;
  city: string;
  audience: string;
}

/* ------------------------------------------------------------------ */
/*  Known cities                                                        */
/* ------------------------------------------------------------------ */

const CITY_KEYWORDS: Record<string, string[]> = {
  "Phnom Penh": ["phnom penh", "pp"],
  "Siem Reap": ["siem reap", "angkor"],
  "Sihanoukville": ["sihanoukville", "kampong som"],
  "Kampot": ["kampot"],
  "Battambang": ["battambang"],
  "Cambodia wide": [],
};

/* ------------------------------------------------------------------ */
/*  Audience detection keywords                                         */
/* ------------------------------------------------------------------ */

const AUDIENCE_KEYWORDS: Record<string, string[]> = {
  travellers: ["travel", "tourist", "visit", "backpack", "sightseeing", "tour", "holiday", "vacation", "trip"],
  teachers: ["teach", "tefl", "school", "salary", "hiring", "classroom", "work permit", "esl"],
  both: [],
};

/* ------------------------------------------------------------------ */
/*  Step A: Build coverage map                                          */
/* ------------------------------------------------------------------ */

export async function buildCoverageMap(): Promise<CoverageEntry[]> {
  const entries: CoverageEntry[] = [];

  // 1. Static posts from posts.json
  try {
    const staticPosts = getPostsMeta();
    for (const post of staticPosts) {
      const lower = `${post.title} ${post.description} ${post.slug}`.toLowerCase();
      entries.push({
        slug: post.slug,
        title: post.title.replace(" | GlobeScraper", ""),
        intents: detectIntents(lower),
        cities: detectCities(lower),
        audiences: detectAudiences(lower),
        source: "static",
      });
    }
  } catch {
    // posts.json might not exist
  }

  // 2. AI drafts and published articles from the database
  try {
    const aiArticles = await prisma.generatedArticleDraft.findMany({
      where: { status: { in: ["PUBLISHED", "DRAFT"] } },
      select: {
        slug: true,
        title: true,
        city: true,
        topic: true,
        audience: true,
        metaDescription: true,
        targetKeyword: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    for (const article of aiArticles) {
      const lower = `${article.title} ${article.topic} ${article.metaDescription} ${article.targetKeyword || ""} ${article.slug}`.toLowerCase();
      entries.push({
        slug: article.slug,
        title: article.title,
        intents: detectIntents(lower),
        cities: article.city ? [article.city] : detectCities(lower),
        audiences: article.audience ? article.audience.split(",").map((a) => a.trim().toLowerCase()) : detectAudiences(lower),
        source: article.status === "PUBLISHED" ? "ai_published" : "ai_draft",
        createdAt: article.createdAt,
      });
    }
  } catch {
    // Database might not be available
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/*  Step B: Identify gaps and opportunities                             */
/* ------------------------------------------------------------------ */

export function identifyGaps(
  coverage: CoverageEntry[],
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const now = Date.now();

  for (const intent of INTENT_VOCABULARY) {
    // Find all entries covering this intent
    const covering = coverage.filter((e) => e.intents.includes(intent));

    // Filter by city focus
    const cityRelevant = cityFocus === "Cambodia wide"
      ? covering
      : covering.filter((e) => e.cities.includes(cityFocus) || e.cities.length === 0);

    // Filter by audience
    const audienceRelevant = audienceFocus === "both"
      ? cityRelevant
      : cityRelevant.filter((e) =>
          e.audiences.includes(audienceFocus) || e.audiences.includes("both") || e.audiences.length === 0
        );

    const count = audienceRelevant.length;
    const lastCovered = audienceRelevant
      .filter((e) => e.createdAt)
      .sort((a, b) => (b.createdAt!.getTime() - a.createdAt!.getTime()))[0]?.createdAt;

    // Staleness: how old is the most recent coverage? (0=fresh, 10=very stale or never covered)
    let staleness = 10;
    if (lastCovered) {
      const daysSince = (now - lastCovered.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) staleness = 1;
      else if (daysSince < 30) staleness = 3;
      else if (daysSince < 90) staleness = 5;
      else if (daysSince < 180) staleness = 7;
      else staleness = 9;
    }

    const isFresh = (FRESHNESS_INTENTS as readonly string[]).includes(intent);

    gaps.push({
      intent,
      isFreshnessRelevant: isFresh,
      coverageCount: count,
      lastCoveredAt: lastCovered,
      staleness,
    });
  }

  return gaps;
}

/* ------------------------------------------------------------------ */
/*  Intent stem normalisation (used by fallback)                        */
/* ------------------------------------------------------------------ */

/** Normalize an intent to a template key stem. */
function intentToTemplateStem(intent: string): string {
  const map: Record<string, string> = {
    "visa": "visa", "e-visa": "visa", "evisa": "visa", "immigration": "visa", "passport": "visa",
    "border": "border", "entry": "border",
    "transport": "transport", "airport": "transport", "bus": "transport",
    "tuk-tuk": "transport", "taxi": "transport", "grab": "transport", "flight": "transport",
    "safety": "safety", "scams": "safety", "crime": "safety", "police": "safety",
    "healthcare": "healthcare", "hospital": "healthcare", "pharmacy": "healthcare",
    "insurance": "healthcare", "dentist": "healthcare",
    "SIM": "SIM", "sim card": "SIM", "mobile": "SIM", "internet": "SIM", "wifi": "SIM",
    "banking": "banking", "ATM": "banking", "money": "banking", "exchange": "banking", "currency": "banking",
    "renting": "renting", "apartment": "renting", "housing": "renting",
    "deposit": "renting", "lease": "renting", "landlord": "renting",
    "cost of living": "cost of living", "budget": "cost of living", "prices": "cost of living",
    "inflation": "cost of living", "fees": "cost of living",
    "teaching": "teaching", "TEFL": "teaching", "school": "teaching",
    "salary": "teaching", "hiring": "teaching", "work permit": "teaching",
    "neighbourhood": "neighbourhood", "neighborhood": "neighbourhood",
    "area": "neighbourhood", "district": "neighbourhood",
    "food": "food", "restaurant": "food", "street food": "food", "market": "food",
    "coworking": "coworking", "digital nomad": "coworking", "remote work": "coworking", "freelance": "coworking",
    "festival": "festival", "event": "festival", "holiday": "festival", "khmer new year": "festival",
  };
  return map[intent] || intent;
}

/* ------------------------------------------------------------------ */
/*  Step E: Choose best title (main entry point) — Gemini-powered       */
/* ------------------------------------------------------------------ */

const GeneratedTitleSchema = z.object({
  title: z.string().min(10).max(120),
  why: z.array(z.string()),
  keywords: z.array(z.string()),
});

export async function generateBestTitle(
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): Promise<{ title: string; why: string[]; keywords: string[] }> {
  // Step A: Build coverage map
  const coverage = await buildCoverageMap();

  // Step B: Identify gaps
  const gaps = identifyGaps(coverage, cityFocus, audienceFocus);

  // Step C: Score gaps and pick top uncovered intents
  const scoredGaps = gaps
    .map((g) => {
      let gapScore = 0;
      if (g.coverageCount === 0) gapScore += 40;
      else if (g.coverageCount === 1) gapScore += 20;
      else gapScore += 5;
      gapScore += g.staleness * 3;
      if (g.isFreshnessRelevant) gapScore += 15;
      return { ...g, gapScore };
    })
    .sort((a, b) => b.gapScore - a.gapScore);

  // Pick a random subset of top gaps to feed to Gemini (prevents determinism)
  const topGaps = scoredGaps.slice(0, 12);
  // Shuffle the top gaps so Gemini sees them in random order each time
  for (let i = topGaps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [topGaps[i], topGaps[j]] = [topGaps[j], topGaps[i]];
  }
  // Pick 4-6 random gaps for the prompt
  const selectedGaps = topGaps.slice(0, 4 + Math.floor(Math.random() * 3));

  // Build list of existing titles to avoid
  const existingTitles = coverage.map((e) => e.title).slice(0, 30);

  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const audienceLabel = audienceFocus === "both"
    ? "both travellers and teachers"
    : audienceFocus === "travellers" ? "travellers and tourists" : "English teachers and expats";

  const gapSummary = selectedGaps.map(
    (g) => `- "${g.intent}" (covered ${g.coverageCount}x, staleness ${g.staleness}/10${g.isFreshnessRelevant ? ", time-sensitive" : ""})`
  ).join("\n");

  const existingList = existingTitles.map((t) => `- ${t}`).join("\n");

  const prompt = `You are a blog title generator for GlobeScraper, a Cambodia travel and expat information site.

TASK: Generate ONE unique, specific, SEO-friendly blog title about ${city} for ${audienceLabel}.

CITY FOCUS: ${cityFocus}
AUDIENCE FOCUS: ${audienceFocus}

Here are content gap areas we haven't covered well (pick ONE to write about — choose something DIFFERENT every time):
${gapSummary}

EXISTING TITLES (do NOT repeat or closely match any of these):
${existingList}

RULES:
1. The title MUST be specific to ${city} (mention the city by name)
2. The title MUST be relevant to ${audienceLabel}
3. Pick a DIFFERENT gap/topic each time — do NOT default to visa topics
4. Make it sound like a real, helpful blog post (not clickbait)
5. Include a year or "Updated" if the topic is time-sensitive
6. Keep it under 80 characters if possible
7. Do NOT use em dashes (—)
8. Be creative and vary your approach — sometimes use "How to", sometimes "Guide to", sometimes a question, sometimes a list format like "X Things..."

Return a JSON object with: title, why (array of reasons this was chosen), keywords (array of 3-5 SEO keywords).`;

  try {
    const result = await callGeminiWithSchema(prompt, GeneratedTitleSchema, "title generation result");
    return {
      title: result.data.title,
      why: result.data.why,
      keywords: result.data.keywords,
    };
  } catch (err) {
    console.error("[Generate Title] Gemini call failed, using random template fallback:", err);
    // Fallback: pick a random template from a random gap
    return randomTemplateFallback(selectedGaps, city, audienceFocus);
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback: random template if Gemini fails                           */
/* ------------------------------------------------------------------ */

const FALLBACK_TEMPLATES: Record<string, string[]> = {
  visa: ["{city} Visa Guide: What You Need to Know", "{city} Entry Requirements Update"],
  border: ["{city} Border Crossing Tips", "Arriving in {city}: Updated Entry Guide"],
  transport: ["{city} Transport Guide: Getting Around Safely", "How to Get Around {city} on a Budget"],
  safety: ["{city} Safety Tips: What to Watch Out For", "Staying Safe in {city}: Practical Advice"],
  healthcare: ["{city} Healthcare Guide: Clinics and Insurance", "Medical Care in {city}: What to Expect"],
  renting: ["Renting in {city}: A Practical Guide", "{city} Housing: Finding the Right Place"],
  "cost of living": ["{city} Cost of Living: Monthly Budget Breakdown", "How Much Does It Cost to Live in {city}?"],
  teaching: ["Teaching English in {city}: What to Expect", "{city} TEFL Jobs: Salaries and Schools"],
  SIM: ["{city} SIM Cards and Internet: Setup Guide", "Getting Connected in {city}: Phone and WiFi"],
  banking: ["{city} Banking and ATMs: Money Guide", "Managing Money in {city}: Cards, Cash, and Apps"],
  food: ["{city} Food Guide: Street Food and Markets", "Best Eats in {city}: Where Locals Go"],
  coworking: ["{city} Digital Nomad Guide: Workspaces and WiFi", "Best Coworking Spaces in {city}"],
  festival: ["Festivals in {city}: What to See and When", "Visiting {city} During Khmer New Year"],
};

function randomTemplateFallback(
  selectedGaps: Array<{ intent: string; gapScore: number }>,
  city: string,
  audienceFocus: AudienceFocus
): { title: string; why: string[]; keywords: string[] } {
  // Pick a random gap
  const gap = selectedGaps[Math.floor(Math.random() * selectedGaps.length)];
  const stem = intentToTemplateStem(gap?.intent || "transport");
  const templates = FALLBACK_TEMPLATES[stem] || FALLBACK_TEMPLATES["transport"];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const title = template.replace(/\{city\}/g, city);
  return {
    title,
    why: [`fallback: Gemini unavailable, random template for "${gap?.intent || "general"}"`, `audience: ${audienceFocus}`],
    keywords: [city.toLowerCase(), gap?.intent || "travel", audienceFocus],
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function detectIntents(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const intent of INTENT_VOCABULARY) {
    if (lower.includes(intent.toLowerCase())) {
      found.push(intent);
    }
  }
  return [...new Set(found)];
}

function detectCities(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const [city, keywords] of Object.entries(CITY_KEYWORDS)) {
    if (city === "Cambodia wide") continue;
    if (lower.includes(city.toLowerCase())) {
      found.push(city);
      continue;
    }
    if (keywords.some((kw) => lower.includes(kw))) {
      found.push(city);
    }
  }
  return found;
}

function detectAudiences(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const [aud, keywords] of Object.entries(AUDIENCE_KEYWORDS)) {
    if (aud === "both") continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      found.push(aud);
    }
  }
  return found;
}

/* ------------------------------------------------------------------ */
/*  Keyword extraction (used by search-topics with seed title)          */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "it", "its", "this", "that", "these", "those", "my", "your", "his",
  "her", "our", "their", "what", "which", "who", "whom", "how", "when",
  "where", "why", "not", "no", "nor", "so", "if", "then", "than",
  "too", "very", "just", "about", "up", "out", "all", "also",
]);

export function extractKeywords(title: string): {
  keywords: string[];
  detectedCity: string | null;
  detectedIntents: string[];
  isGeneric: boolean;
} {
  const lower = title.toLowerCase();

  // Detect city
  let detectedCity: string | null = null;
  for (const [city, kws] of Object.entries(CITY_KEYWORDS)) {
    if (city === "Cambodia wide") continue;
    if (lower.includes(city.toLowerCase()) || kws.some((kw) => lower.includes(kw))) {
      detectedCity = city;
      break;
    }
  }

  // Detect intents
  const detectedIntents = detectIntents(lower);

  // Extract meaningful keywords
  const words = lower
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const keywords = [...new Set(words)];

  // Determine if generic
  const isGeneric = !detectedCity && detectedIntents.length === 0 && keywords.length < 3;

  return { keywords, detectedCity, detectedIntents, isGeneric };
}
