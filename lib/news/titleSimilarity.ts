/**
 * Title similarity checking for the Cambodia News Blog Generator.
 *
 * Compares a candidate title against existing titles in the database
 * to prevent near-duplicates.
 */

import { prisma } from "@/lib/prisma";
import { getPostsMeta } from "@/lib/content";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface SimilarityCheckResult {
  isDuplicate: boolean;
  reason?: string;
  closestTitles: string[];
}

/* ------------------------------------------------------------------ */
/*  Normalisation helpers                                               */
/* ------------------------------------------------------------------ */

/** Lowercase, strip punctuation, collapse whitespace. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract word bigrams from a normalised string. */
function bigrams(text: string): Set<string> {
  const words = text.split(" ");
  const bg = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bg.add(`${words[i]} ${words[i + 1]}`);
  }
  return bg;
}

/** Jaccard similarity on word sets (0–1). */
function jaccardWords(a: string, b: string): number {
  const setA = new Set(normalise(a).split(" "));
  const setB = new Set(normalise(b).split(" "));
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/** Bigram overlap ratio (0–1). */
function bigramOverlap(a: string, b: string): number {
  const bgA = bigrams(normalise(a));
  const bgB = bigrams(normalise(b));
  if (bgA.size === 0 || bgB.size === 0) return 0;
  const intersection = new Set([...bgA].filter((bg) => bgB.has(bg)));
  const smaller = Math.min(bgA.size, bgB.size);
  return intersection.size / smaller;
}

/* ------------------------------------------------------------------ */
/*  Fetch all existing titles                                           */
/* ------------------------------------------------------------------ */

async function getAllExistingTitles(): Promise<string[]> {
  const titles: string[] = [];

  // Static posts
  try {
    const staticPosts = getPostsMeta();
    for (const p of staticPosts) {
      titles.push(p.title.replace(" | GlobeScraper", ""));
    }
  } catch { /* noop */ }

  // AI drafts + published
  try {
    const aiArticles = await prisma.generatedArticleDraft.findMany({
      where: { status: { in: ["PUBLISHED", "DRAFT"] } },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    for (const a of aiArticles) {
      titles.push(a.title);
    }
  } catch { /* noop */ }

  // Previously generated titles from the log
  try {
    const logs = await prisma.titleGenerationLog.findMany({
      select: { generatedTitle: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const l of logs) {
      titles.push(l.generatedTitle);
    }
  } catch { /* noop */ }

  return [...new Set(titles)];
}

/* ------------------------------------------------------------------ */
/*  Main check                                                          */
/* ------------------------------------------------------------------ */

const JACCARD_THRESHOLD = 0.85;
const BIGRAM_THRESHOLD = 0.8;

/**
 * Check a candidate title against all existing titles.
 * Returns whether the title is a duplicate and the closest matches.
 */
export async function checkTitleSimilarity(
  candidate: string
): Promise<SimilarityCheckResult> {
  const existing = await getAllExistingTitles();
  const normCandidate = normalise(candidate);

  // Track scores for reporting the closest titles
  const scored: Array<{ title: string; jaccard: number; bigram: number }> = [];

  for (const title of existing) {
    const normTitle = normalise(title);

    // 1. Exact match (case-insensitive)
    if (normCandidate === normTitle) {
      return {
        isDuplicate: true,
        reason: `Exact match: "${title}"`,
        closestTitles: [title],
      };
    }

    // 2. Normalised exact match (after stripping punctuation)
    // Already handled above since normalise() strips punctuation

    const jaccard = jaccardWords(candidate, title);
    const bigram = bigramOverlap(candidate, title);
    scored.push({ title, jaccard, bigram });

    // 3. Jaccard word overlap threshold
    if (jaccard > JACCARD_THRESHOLD) {
      return {
        isDuplicate: true,
        reason: `Too similar (Jaccard ${(jaccard * 100).toFixed(0)}%): "${title}"`,
        closestTitles: scored.sort((a, b) => b.jaccard - a.jaccard).slice(0, 10).map((s) => s.title),
      };
    }

    // 4. Bigram overlap threshold
    if (bigram > BIGRAM_THRESHOLD) {
      return {
        isDuplicate: true,
        reason: `Too similar (bigram ${(bigram * 100).toFixed(0)}%): "${title}"`,
        closestTitles: scored.sort((a, b) => b.bigram - a.bigram).slice(0, 10).map((s) => s.title),
      };
    }
  }

  // Not a duplicate — return the top 10 closest for potential use in anti-dup prompts
  const closestTitles = scored
    .sort((a, b) => b.jaccard - a.jaccard)
    .slice(0, 10)
    .map((s) => s.title);

  return { isDuplicate: false, closestTitles };
}
