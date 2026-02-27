/**
 * Deterministic topic rotation for the Cambodia News Blog Generator.
 *
 * Backend picks the next gap topic from a fixed list, rotating to avoid
 * repeating any topic used in the last N runs. Uses TitleGenerationLog
 * in the database to track history.
 */

import { prisma } from "@/lib/prisma";
import type { CityFocus, AudienceFocus } from "@/lib/newsTopicTypes";

/* ------------------------------------------------------------------ */
/*  Gap topic list                                                      */
/* ------------------------------------------------------------------ */

export const GAP_TOPICS = [
  "airport",
  "entry",
  "scams",
  "visa",
  "transport",
  "flight",
  "SIM",
  "banking",
  "renting",
  "cost of living",
  "healthcare",
  "teaching",
  "food",
  "safety",
  "coworking",
] as const;

export type GapTopic = (typeof GAP_TOPICS)[number];

/** How many recent topics to exclude before picking the next one. */
const LOOKBACK_N = 3;

/* ------------------------------------------------------------------ */
/*  Topic → primary-keyword mapping                                     */
/* ------------------------------------------------------------------ */

export const KEYWORD_MAP: Record<GapTopic, string[][]> = {
  transport: [
    ["PassApp", "Phnom Penh"],
    ["Grab", "Phnom Penh"],
    ["tuk tuk", "Phnom Penh"],
  ],
  airport: [
    ["airport", "Phnom Penh"],
    ["PNH", "airport"],
    ["international airport", "Phnom Penh"],
  ],
  scams: [
    ["scams", "Phnom Penh"],
    ["tourist scams", "Phnom Penh"],
  ],
  visa: [
    ["visa", "Cambodia", "Phnom Penh"],
    ["e-visa", "Phnom Penh"],
  ],
  entry: [
    ["entering Cambodia", "Phnom Penh"],
    ["entry requirements", "Phnom Penh"],
  ],
  flight: [
    ["flights", "Phnom Penh"],
    ["cheap flights", "Phnom Penh"],
  ],
  SIM: [
    ["SIM card", "Phnom Penh"],
    ["SIM card", "Cambodia"],
  ],
  banking: [
    ["ATM", "Cambodia"],
    ["banking", "Phnom Penh"],
  ],
  renting: [
    ["renting", "apartment", "Phnom Penh"],
    ["housing", "Phnom Penh"],
  ],
  "cost of living": [
    ["cost of living", "Phnom Penh"],
    ["budget", "Phnom Penh"],
  ],
  healthcare: [
    ["hospital", "Phnom Penh"],
    ["healthcare", "Cambodia"],
  ],
  teaching: [
    ["teaching English", "Phnom Penh"],
    ["TEFL jobs", "Cambodia"],
  ],
  food: [
    ["street food", "Phnom Penh"],
    ["best restaurants", "Phnom Penh"],
  ],
  safety: [
    ["safety tips", "Phnom Penh"],
    ["is Phnom Penh safe"],
  ],
  coworking: [
    ["coworking spaces", "Phnom Penh"],
    ["digital nomad", "Phnom Penh"],
  ],
};

/* ------------------------------------------------------------------ */
/*  City-specific keyword overrides                                     */
/* ------------------------------------------------------------------ */

/**
 * Swap "Phnom Penh" portions of a keyword for the actual city focus.
 * For "Cambodia wide" we leave as-is (most keywords already reference Cambodia).
 */
function localiseTerm(term: string, cityFocus: CityFocus): string {
  if (cityFocus === "Phnom Penh") return term;
  if (cityFocus === "Cambodia wide") {
    return term.replace(/Phnom Penh/gi, "Cambodia");
  }
  // Siem Reap, etc.
  return term.replace(/Phnom Penh/gi, cityFocus);
}

/* ------------------------------------------------------------------ */
/*  getNextGapTopic                                                     */
/* ------------------------------------------------------------------ */

export interface GapTopicResult {
  selectedTopic: GapTopic;
  primaryKeywordTerms: string[];
}

/**
 * Pick the next gap topic, avoiding the last N topics used for the same
 * (cityFocus, audienceFocus) pair.
 */
export async function getNextGapTopic({
  cityFocus,
  audienceFocus,
}: {
  cityFocus: CityFocus;
  audienceFocus: AudienceFocus;
}): Promise<GapTopicResult> {
  // Fetch recent topic picks from DB
  let recentTopics: string[] = [];
  try {
    const recentLogs = await prisma.titleGenerationLog.findMany({
      where: { cityFocus, audienceFocus },
      orderBy: { createdAt: "desc" },
      take: LOOKBACK_N,
      select: { selectedTopic: true },
    });
    recentTopics = recentLogs.map((l) => l.selectedTopic);
  } catch {
    // DB might not have the table yet — fall through to random
    console.warn("[TopicRotation] Could not read TitleGenerationLog, using random fallback");
  }

  // Filter out recently used topics
  const available = GAP_TOPICS.filter((t) => !recentTopics.includes(t));

  // If all filtered out (shouldn't happen with N=3 and 15 topics), use full list
  const pool = available.length > 0 ? available : [...GAP_TOPICS];

  // Pick randomly from the available pool (deterministic-enough: avoids recent repeats)
  const selectedTopic = pool[Math.floor(Math.random() * pool.length)];

  // Pick a random keyword term set for the topic, localised to the city
  const keywordSets = KEYWORD_MAP[selectedTopic];
  const rawTerms = keywordSets[Math.floor(Math.random() * keywordSets.length)];
  const primaryKeywordTerms = rawTerms.map((t) => localiseTerm(t, cityFocus));

  return { selectedTopic, primaryKeywordTerms };
}
