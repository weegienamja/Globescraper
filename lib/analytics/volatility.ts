/**
 * Volatility utilities for rental analytics.
 *
 * Provides rolling-window and annualized volatility measures
 * on top of RentalIndexDaily data.
 */

import type { IndexRow } from "./calculateStats";
import { stdDev, weightedMedian } from "./calculateStats";

/* ── Rolling Volatility ──────────────────────────────────── */

export interface VolatilityPoint {
  date: string;
  volatility: number;
  windowSize: number;
}

/**
 * Compute rolling volatility (std dev of daily median) over a sliding window.
 * Default window: 30 days.
 */
export function rollingVolatility(
  rows: IndexRow[],
  windowDays = 30,
): VolatilityPoint[] {
  // Group by date
  const byDate = new Map<number, IndexRow[]>();
  for (const r of rows) {
    const key = r.date.getTime();
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r);
  }

  const dates = Array.from(byDate.keys()).sort((a, b) => a - b);
  const dailyMedians = dates.map((d) => ({
    ts: d,
    median: weightedMedian(byDate.get(d)!),
  }));

  const results: VolatilityPoint[] = [];

  for (let i = 0; i < dailyMedians.length; i++) {
    const windowStart = dailyMedians[i].ts - windowDays * 86400000;
    const windowValues: number[] = [];
    for (let j = 0; j <= i; j++) {
      if (dailyMedians[j].ts >= windowStart && dailyMedians[j].median !== null) {
        windowValues.push(dailyMedians[j].median!);
      }
    }

    results.push({
      date: new Date(dailyMedians[i].ts).toISOString().slice(0, 10),
      volatility: windowValues.length >= 2 ? stdDev(windowValues) : 0,
      windowSize: windowValues.length,
    });
  }

  return results;
}

/* ── District Volatility Rankings ────────────────────────── */

export interface DistrictVolatility {
  district: string;
  volatility: number;
  dataPoints: number;
}

/**
 * Rank districts by their overall price volatility across the time range.
 */
export function districtVolatilities(rows: IndexRow[]): DistrictVolatility[] {
  const byDistrict = new Map<string, number[]>();

  for (const r of rows) {
    const d = r.district ?? "Unknown";
    if (d === "Unknown") continue;
    if (r.medianPriceUsd === null) continue;
    if (!byDistrict.has(d)) byDistrict.set(d, []);
    byDistrict.get(d)!.push(r.medianPriceUsd);
  }

  const results: DistrictVolatility[] = [];
  for (const [district, values] of byDistrict) {
    if (values.length < 3) continue;
    results.push({
      district,
      volatility: stdDev(values),
      dataPoints: values.length,
    });
  }

  return results.sort((a, b) => b.volatility - a.volatility);
}

/**
 * Compute a normalized 0-100 volatility score for a set of price values.
 * 0 = perfectly stable, 100 = extremely volatile.
 * Uses coefficient of variation (CV) scaled to 0-100.
 */
export function volatilityScore(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const cv = stdDev(values) / mean;
  // Scale: CV of 0.3 (30%) = score of 100, capped
  return Math.min(100, Math.round(cv * 333));
}
