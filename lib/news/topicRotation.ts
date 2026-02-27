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

export const KEYWORD_MAP: Record<GapTopic, string[]> = {
  transport: [
    "PassApp Phnom Penh",
    "Grab Phnom Penh",
    "Phnom Penh tuk tuk",
  ],
  airport: [
    "Phnom Penh airport",
    "PNH airport",
    "Phnom Penh international airport",
  ],
  scams: [
    "Phnom Penh scams",
    "tourist scams Phnom Penh",
  ],
  visa: [
    "Cambodia visa Phnom Penh",
    "Phnom Penh e-visa",
  ],
  entry: [
    "entering Cambodia via Phnom Penh",
    "Phnom Penh entry requirements",
  ],
  flight: [
    "flights to Phnom Penh",
    "cheap flights Phnom Penh",
  ],
  SIM: [
    "SIM card Phnom Penh",
    "Cambodia SIM card",
  ],
  banking: [
    "ATM Cambodia",
    "Phnom Penh banking",
  ],
  renting: [
    "renting apartment Phnom Penh",
    "Phnom Penh housing",
  ],
  "cost of living": [
    "cost of living Phnom Penh",
    "Phnom Penh budget",
  ],
  healthcare: [
    "Phnom Penh hospital",
    "healthcare in Cambodia",
  ],
  teaching: [
    "teaching English Phnom Penh",
    "TEFL jobs Cambodia",
  ],
  food: [
    "Phnom Penh street food",
    "best restaurants Phnom Penh",
  ],
  safety: [
    "Phnom Penh safety tips",
    "is Phnom Penh safe",
  ],
  coworking: [
    "coworking spaces Phnom Penh",
    "digital nomad Phnom Penh",
  ],
};

/* ------------------------------------------------------------------ */
/*  City-specific keyword overrides                                     */
/* ------------------------------------------------------------------ */

/**
 * Swap "Phnom Penh" portions of a keyword for the actual city focus.
 * For "Cambodia wide" we leave as-is (most keywords already reference Cambodia).
 */
function localiseKeyword(keyword: string, cityFocus: CityFocus): string {
  if (cityFocus === "Phnom Penh") return keyword;
  if (cityFocus === "Cambodia wide") {
    // Keep Cambodia-level keywords as-is; replace city-specific ones
    return keyword.replace(/Phnom Penh/gi, "Cambodia");
  }
  // Siem Reap
  return keyword.replace(/Phnom Penh/gi, cityFocus);
}

/* ------------------------------------------------------------------ */
/*  getNextGapTopic                                                     */
/* ------------------------------------------------------------------ */

export interface GapTopicResult {
  selectedTopic: GapTopic;
  primaryKeyword: string;
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

  // Pick a random primary keyword for the topic, localised to the city
  const keywords = KEYWORD_MAP[selectedTopic];
  const rawKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  const primaryKeyword = localiseKeyword(rawKeyword, cityFocus);

  return { selectedTopic, primaryKeyword };
}
