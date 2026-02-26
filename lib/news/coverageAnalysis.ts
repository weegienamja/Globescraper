/**
 * Coverage analysis for the Cambodia News Blog Generator.
 *
 * Scans existing GlobeScraper posts and AI drafts, maps covered intents,
 * identifies gaps, and produces scored candidate titles for "Generate Title".
 */

import { prisma } from "@/lib/prisma";
import { getPostsMeta } from "@/lib/content";
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
/*  Step C & D: Build and score candidate titles                        */
/* ------------------------------------------------------------------ */

/** Title templates organized by intent+audience combos. */
const TITLE_TEMPLATES: Record<string, string[]> = {
  "visa_travellers": [
    "{city} Visa and Entry Requirements: What Changed and What to Expect",
    "{city} E-Visa Application Process: Step by Step for First Time Visitors",
    "Cambodia Visa on Arrival vs E-Visa: Which to Choose When Flying into {city}",
  ],
  "visa_teachers": [
    "{city} Work Visa and Business Visa for Teachers: What You Actually Need",
    "Cambodia Work Permit for English Teachers: Costs, Process, and Common Mistakes",
  ],
  "border_travellers": [
    "{city} Border Crossing and Entry Points: Updated Rules and Tips",
    "Cambodia Land Border Crossings: What to Know Before Your Trip to {city}",
  ],
  "transport_travellers": [
    "{city} Airport and Entry Process Updates: What to Expect",
    "{city} Getting Around: Transport Options, Costs, and Safety Tips",
    "{city} Night Transport and Late Ride Safety: What Changed and How to Plan",
    "Cambodia Domestic Flights vs Bus: Getting Between {city} and Other Cities",
  ],
  "transport_teachers": [
    "{city} Daily Commute Options for Teachers: Costs, Routes, and Realistic Times",
    "Buying vs Renting a Motorbike in {city}: What Teachers Need to Know",
  ],
  "safety_travellers": [
    "{city} Safety and Common Scams Tourists Face: How to Stay Smart",
    "New Fees and Common Extra Charges Tourists Hit in {city} and How to Avoid Them",
    "{city} Solo Travel Safety: Updated Advice for First Timers",
  ],
  "safety_teachers": [
    "{city} Safety Tips for New Teachers: What to Watch Out For",
  ],
  "healthcare_travellers": [
    "{city} Healthcare for Tourists: Emergency Clinics, Pharmacies, and Insurance Tips",
    "Cambodia Travel Insurance: What to Get Before Flying into {city}",
  ],
  "healthcare_teachers": [
    "{city} Healthcare for Expats and Teachers: Clinics, Insurance, and What It Costs",
  ],
  "renting_travellers": [
    "{city} Short Stay Accommodation: Beyond Hotels and Hostels",
  ],
  "renting_teachers": [
    "{city} Renting Checklist: Deposits, Contracts, and Utility Setups Teachers Miss",
    "{city} Best Neighbourhoods for Teachers: Rent, Commute, and Lifestyle",
  ],
  "cost of living_travellers": [
    "{city} Daily Budget Breakdown: What Things Actually Cost for Tourists",
    "{city} Money Saving Tips: Where Tourists Overpay and What to Do Instead",
  ],
  "cost of living_teachers": [
    "{city} Cost of Living for Teachers: Realistic Monthly Budget Breakdown",
    "Cambodia Teacher Salary vs Cost of Living: Can You Save Money in {city}?",
  ],
  "teaching_teachers": [
    "{city} School Hiring Cycle: When Jobs Open and What Salaries Look Like Now",
    "Cambodia TEFL Jobs: What Schools in {city} Actually Look For",
    "{city} Teaching Contract Red Flags: What to Check Before Signing",
  ],
  "SIM_travellers": [
    "{city} SIM Card and Mobile Data: Which Provider and Plan to Pick",
    "Cambodia eSIM vs Physical SIM: What Works Best for Tourists in {city}",
  ],
  "SIM_teachers": [
    "{city} Phone and Internet Setup for New Teachers: SIM, WiFi, and Apps",
  ],
  "banking_travellers": [
    "{city} ATMs, Cash, and Cards: Money Tips for Tourists",
  ],
  "banking_teachers": [
    "{city} Banking for Teachers: Opening an Account and Getting Paid",
  ],
  "food_travellers": [
    "{city} Street Food Guide: What to Eat, Where, and What It Costs",
    "{city} Best Markets for Food and Shopping: A Tourist Walkthrough",
  ],
  "neighbourhood_teachers": [
    "{city} Area Guide for Teachers: Where to Live Based on Your School",
  ],
  "coworking_travellers": [
    "{city} Coworking Spaces and Cafes for Digital Nomads: Updated List",
  ],
  "festival_travellers": [
    "Visiting {city} During Khmer New Year: What to Expect and How to Prepare",
    "Cambodia Festival Calendar: Best Times to Visit {city}",
  ],
};

/** Normalize an intent to a template key stem. */
function intentToTemplateStem(intent: string): string {
  // Map related intents to a common stem
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

export function buildCandidateTitles(
  gaps: CoverageGap[],
  coverage: CoverageEntry[],
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): CandidateTitle[] {
  const candidates: CandidateTitle[] = [];
  const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
  const audiences = audienceFocus === "both" ? ["travellers", "teachers"] : [audienceFocus];

  // Score and sort gaps: prefer uncovered + freshness-relevant + stale
  const scoredGaps = gaps
    .map((g) => {
      let gapScore = 0;
      if (g.coverageCount === 0) gapScore += 40;
      else if (g.coverageCount === 1) gapScore += 20;
      else gapScore += 5;
      gapScore += g.staleness * 3; // 0-30
      if (g.isFreshnessRelevant) gapScore += 15;
      return { ...g, gapScore };
    })
    .sort((a, b) => b.gapScore - a.gapScore);

  // Pick top gaps and generate titles
  for (const gap of scoredGaps.slice(0, 15)) {
    const stem = intentToTemplateStem(gap.intent);

    for (const aud of audiences) {
      const templateKey = `${stem}_${aud}`;
      const templates = TITLE_TEMPLATES[templateKey] || [];

      for (const template of templates.slice(0, 2)) {
        const title = template.replace(/\{city\}/g, city);

        // Build why reasons
        const why: string[] = [];
        if (gap.coverageCount === 0) why.push("gap: not covered");
        else why.push(`weak coverage: ${gap.coverageCount} article(s)`);
        if (gap.isFreshnessRelevant) why.push("freshness-relevant topic");
        if (gap.staleness >= 7) why.push("content is stale");
        why.push(`intent: ${gap.intent}`);
        why.push(`audience: ${aud}`);
        why.push(`city: ${city}`);

        // Keywords
        const keywords = [city.toLowerCase(), gap.intent, aud];
        if (stem !== gap.intent) keywords.push(stem);

        candidates.push({
          title,
          score: gap.gapScore,
          why,
          keywords,
          intent: gap.intent,
          city,
          audience: aud,
        });
      }
    }
  }

  return candidates;
}

/* ------------------------------------------------------------------ */
/*  Step D: Uniqueness check via trigram similarity                      */
/* ------------------------------------------------------------------ */

function trigramSet(text: string): Set<string> {
  const s = new Set<string>();
  const lower = text.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  for (let i = 0; i <= lower.length - 3; i++) {
    s.add(lower.slice(i, i + 3));
  }
  return s;
}

function trigramSimilarity(a: string, b: string): number {
  const setA = trigramSet(a);
  const setB = trigramSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const tri of setA) {
    if (setB.has(tri)) intersection++;
  }
  return intersection / Math.max(setA.size, setB.size);
}

export function filterUniqueTitles(
  candidates: CandidateTitle[],
  existingTitles: string[],
  threshold = 0.62
): CandidateTitle[] {
  return candidates.filter((c) => {
    for (const existing of existingTitles) {
      if (trigramSimilarity(c.title, existing) > threshold) {
        return false;
      }
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Step E: Choose best title (main entry point)                        */
/* ------------------------------------------------------------------ */

export async function generateBestTitle(
  cityFocus: CityFocus,
  audienceFocus: AudienceFocus
): Promise<{ title: string; why: string[]; keywords: string[] }> {
  // Step A: Build coverage map
  const coverage = await buildCoverageMap();

  // Step B: Identify gaps
  const gaps = identifyGaps(coverage, cityFocus, audienceFocus);

  // Step C: Build candidate titles
  const candidates = buildCandidateTitles(gaps, coverage, cityFocus, audienceFocus);

  // Step D: Filter for uniqueness
  const existingTitles = coverage.map((e) => e.title);
  const unique = filterUniqueTitles(candidates, existingTitles);

  // Step E: Return best
  if (unique.length === 0) {
    // Fallback: use the best candidate even if somewhat similar
    const best = candidates[0];
    if (best) {
      return { title: best.title, why: [...best.why, "note: may overlap with existing content"], keywords: best.keywords };
    }
    // Ultimate fallback
    const city = cityFocus === "Cambodia wide" ? "Cambodia" : cityFocus;
    return {
      title: `${city} Travel and Living Update: What Changed Recently`,
      why: ["fallback: no specific gaps identified"],
      keywords: [city.toLowerCase(), "travel", "update"],
    };
  }

  // Sort by score descending, pick best
  unique.sort((a, b) => b.score - a.score);
  const best = unique[0];
  return { title: best.title, why: best.why, keywords: best.keywords };
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
