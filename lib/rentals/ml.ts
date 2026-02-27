/**
 * ML Feature Stubs for Rental Pipeline
 *
 * All ML features are behind environment flags and disabled by default.
 * - RENTALS_ML_ENABLED=false   → rule-based district normalization, dedup
 * - RENTALS_EMBEDDINGS_ENABLED=false → external embedding API calls
 */

import { ML_ENABLED, EMBEDDINGS_ENABLED } from "./config";
import { DISTRICT_ALIASES } from "./ml/districtAliases";

/* ── ML Goal 1: District Normalization ───────────────────── */

/**
 * Normalize a district name using rule-based alias mapping.
 * Phase ML-1: cheap, no external AI.
 */
export function normalizeDistrict(raw: string | null): string | null {
  if (!raw || !ML_ENABLED) return raw;

  const lower = raw.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }

  return raw.trim();
}

/* ── ML Goal 1: Near-Duplicate Detection ─────────────────── */

/**
 * Compute trigram similarity between two strings (0..1).
 * Used for near-duplicate detection.
 */
export function trigramSimilarity(a: string, b: string): number {
  if (!ML_ENABLED) return 0;
  if (!a || !b) return 0;

  const trigramsA = getTrigrams(a.toLowerCase());
  const trigramsB = getTrigrams(b.toLowerCase());

  const setA = new Set(trigramsA);
  const setB = new Set(trigramsB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getTrigrams(s: string): string[] {
  const trigrams: string[] = [];
  for (let i = 0; i <= s.length - 3; i++) {
    trigrams.push(s.slice(i, i + 3));
  }
  return trigrams;
}

/* ── ML Goal 2: Outlier Detection ────────────────────────── */

/**
 * Detect price outliers using IQR method.
 * Returns true if the price is an outlier.
 */
export function isPriceOutlier(
  price: number,
  prices: number[],
  multiplier = 1.5
): boolean {
  if (!ML_ENABLED) return false;
  if (prices.length < 5) return false;

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  return price < q1 - multiplier * iqr || price > q3 + multiplier * iqr;
}

/* ── ML Goal 2: Z-Score Outlier ──────────────────────────── */

export function zScoreOutlier(
  price: number,
  prices: number[],
  threshold = 2.5
): boolean {
  if (!ML_ENABLED) return false;
  if (prices.length < 5) return false;

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(
    prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length
  );

  if (stdDev === 0) return false;
  return Math.abs((price - mean) / stdDev) > threshold;
}

/* ── ML Phase 2: Embeddings (stub) ───────────────────────── */

/**
 * Batch compute embeddings for listing texts.
 * STUB: Returns empty array unless RENTALS_EMBEDDINGS_ENABLED is true.
 *
 * TODO Phase ML-2: Implement using Gemini embeddings API.
 * - Micro-batch up to 50 texts per call
 * - Cache by input hash
 * - Store vectors in DB for clustering
 */
export async function computeEmbeddings(
  _texts: string[]
): Promise<number[][]> {
  if (!EMBEDDINGS_ENABLED) return [];
  // TODO: Implement external embedding API call
  return [];
}

/* ── ML Goal 3: Trend Forecasting (stub) ─────────────────── */

/**
 * Simple linear regression for price trend forecasting.
 * STUB: Not required for MVP.
 *
 * TODO: Implement linear regression on medianPriceUsd by date per district.
 * Store forecast results separately.
 */
export function forecastTrend(
  _dataPoints: { date: Date; price: number }[]
): { slope: number; intercept: number } | null {
  if (!ML_ENABLED) return null;
  // TODO: Implement simple linear regression
  return null;
}
