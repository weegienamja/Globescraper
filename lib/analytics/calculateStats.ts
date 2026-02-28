/**
 * Analytics calculation utilities.
 *
 * All functions operate on RentalIndexDaily rows (already aggregated),
 * never on live listings.
 */

export interface IndexRow {
  date: Date;
  city: string;
  district: string | null;
  bedrooms: number | null;
  propertyType: string;
  listingCount: number;
  medianPriceUsd: number | null;
  meanPriceUsd: number | null;
  p25PriceUsd: number | null;
  p75PriceUsd: number | null;
}

/* ── Summary KPI ─────────────────────────────────────────── */

export interface KpiSummary {
  currentMedian: number | null;
  current1Bed: number | null;
  current2Bed: number | null;
  totalListings: number;
  change1m: number | null;
  change3m: number | null;
  volatility: number;
  supplySignal: "oversupply" | "squeeze" | "neutral";
}

/**
 * Compute top-level KPI values from historical index rows.
 * Rows are assumed to be sorted ascending by date.
 */
export function computeKpi(rows: IndexRow[]): KpiSummary {
  if (rows.length === 0) {
    return {
      currentMedian: null,
      current1Bed: null,
      current2Bed: null,
      totalListings: 0,
      change1m: null,
      change3m: null,
      volatility: 0,
      supplySignal: "neutral",
    };
  }

  const latestDate = rows[rows.length - 1].date;
  const latestRows = rows.filter((r) => r.date.getTime() === latestDate.getTime());

  // Current overall median: weighted median of medians by listing count
  const currentMedian = weightedMedian(latestRows);
  const current1Bed = weightedMedian(latestRows.filter((r) => r.bedrooms === 1));
  const current2Bed = weightedMedian(latestRows.filter((r) => r.bedrooms === 2));
  const totalListings = latestRows.reduce((sum, r) => sum + r.listingCount, 0);

  // Group by date → overall median per day
  const dailyMedians = dailyWeightedMedians(rows);
  const dates = Array.from(dailyMedians.keys()).sort((a, b) => a - b);

  // % changes
  const change1m = percentChange(dailyMedians, dates, 30);
  const change3m = percentChange(dailyMedians, dates, 90);

  // Volatility
  const medianValues = dates.map((d) => dailyMedians.get(d)!).filter((v) => v !== null) as number[];
  const volatility = stdDev(medianValues);

  // Supply signal
  const supplySignal = computeSupplySignal(rows, dates);

  return {
    currentMedian,
    current1Bed,
    current2Bed,
    totalListings,
    change1m,
    change3m,
    volatility,
    supplySignal,
  };
}

/* ── Trend Data ──────────────────────────────────────────── */

export interface TrendPoint {
  date: string; // ISO date string
  median: number | null;
  mean: number | null;
  p25: number | null;
  p75: number | null;
  listingCount: number;
  ma90: number | null;
}

/**
 * Compute daily trend data with 90-day moving average.
 */
export function computeTrend(rows: IndexRow[]): TrendPoint[] {
  const dailyMap = new Map<
    number,
    { rows: IndexRow[]; count: number; date: Date }
  >();

  for (const r of rows) {
    const key = r.date.getTime();
    if (!dailyMap.has(key)) {
      dailyMap.set(key, { rows: [], count: 0, date: r.date });
    }
    const entry = dailyMap.get(key)!;
    entry.count += r.listingCount;
    entry.rows.push(r);
  }

  const sorted = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v);

  const points: TrendPoint[] = [];
  const recentMedians: number[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    // Use weighted aggregation (consistent with computeKpi)
    const median = weightedMedian(d.rows);
    const mean = weightedMean(d.rows);
    const p25 = weightedPercentile(d.rows, "p25PriceUsd");
    const p75 = weightedPercentile(d.rows, "p75PriceUsd");

    if (median !== null) recentMedians.push(median);
    // Keep only last 90 values
    if (recentMedians.length > 90) recentMedians.shift();

    const ma90 = recentMedians.length >= 7 ? arrayMean(recentMedians) : null;

    points.push({
      date: d.date.toISOString().slice(0, 10),
      median,
      mean,
      p25,
      p75,
      listingCount: d.count,
      ma90: ma90 !== null ? Math.round(ma90 * 100) / 100 : null,
    });
  }

  return points;
}

/* ── Distribution ────────────────────────────────────────── */

export interface DistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "$0 - $300", min: 0, max: 300 },
  { label: "$300 - $500", min: 300, max: 500 },
  { label: "$500 - $700", min: 500, max: 700 },
  { label: "$700 - $1,000", min: 700, max: 1000 },
  { label: "$1,000+", min: 1000, max: Infinity },
];

/**
 * Compute price distribution from the latest day of index rows.
 */
export function computeDistribution(rows: IndexRow[]): DistributionBucket[] {
  if (rows.length === 0) {
    return BUCKETS.map((b) => ({ ...b, count: 0, percentage: 0 }));
  }

  const latestDate = rows.reduce(
    (max, r) => (r.date.getTime() > max ? r.date.getTime() : max),
    0,
  );
  const latest = rows.filter((r) => r.date.getTime() === latestDate);

  const result = BUCKETS.map((b) => ({ ...b, count: 0, percentage: 0 }));
  let total = 0;

  for (const r of latest) {
    if (r.medianPriceUsd === null) continue;
    const price = r.medianPriceUsd;
    const bucket = result.find((b) => price >= b.min && price < b.max);
    if (bucket) {
      bucket.count += r.listingCount;
      total += r.listingCount;
    }
  }

  if (total > 0) {
    for (const b of result) {
      b.percentage = Math.round((b.count / total) * 1000) / 10;
    }
  }

  return result;
}

/* ── Top Movers ──────────────────────────────────────────── */

export interface MoverRow {
  rank: number;
  district: string;
  change1m: number | null;
  change3m: number | null;
  median: number | null;
  volatility: number;
  listingCount: number;
}

/**
 * Top rising and falling districts by 1-month % change.
 */
export function computeMovers(rows: IndexRow[]): MoverRow[] {
  // Group by district
  const byDistrict = new Map<string, IndexRow[]>();
  for (const r of rows) {
    const d = r.district ?? "Unknown";
    if (!byDistrict.has(d)) byDistrict.set(d, []);
    byDistrict.get(d)!.push(r);
  }

  const movers: MoverRow[] = [];

  for (const [district, distRows] of byDistrict) {
    if (district === "Unknown") continue;

    const dailyMedians = dailyWeightedMedians(distRows);
    const dates = Array.from(dailyMedians.keys()).sort((a, b) => a - b);

    if (dates.length < 2) continue;

    const latestMedian = dailyMedians.get(dates[dates.length - 1]) ?? null;
    const c1m = percentChange(dailyMedians, dates, 30);
    const c3m = percentChange(dailyMedians, dates, 90);

    const vals = dates
      .map((d) => dailyMedians.get(d)!)
      .filter((v) => v !== null) as number[];

    const latestDate = dates[dates.length - 1];
    const latestRows = distRows.filter((r) => r.date.getTime() === latestDate);
    const count = latestRows.reduce((s, r) => s + r.listingCount, 0);

    movers.push({
      rank: 0,
      district,
      change1m: c1m,
      change3m: c3m,
      median: latestMedian,
      volatility: stdDev(vals),
      listingCount: count,
    });
  }

  // Sort by absolute 1m change descending
  movers.sort((a, b) => Math.abs(b.change1m ?? 0) - Math.abs(a.change1m ?? 0));
  movers.forEach((m, i) => (m.rank = i + 1));

  return movers.slice(0, 20);
}

/* ── District Heatmap Data (all districts, no cap) ───────── */

export interface HeatmapDistrictRow {
  district: string;
  listingCount: number;
  medianPriceUsd: number | null;
}

/**
 * Aggregate all districts for the heatmap — NOT capped or filtered.
 * Returns every district with at least 1 listing.
 */
export function computeDistrictHeatmap(rows: IndexRow[]): HeatmapDistrictRow[] {
  const byDistrict = new Map<
    string,
    { listings: number; prices: number[] }
  >();
  for (const r of rows) {
    const d = r.district ?? "Unknown";
    if (d === "Unknown") continue;
    if (!byDistrict.has(d)) byDistrict.set(d, { listings: 0, prices: [] });
    const entry = byDistrict.get(d)!;
    entry.listings += r.listingCount;
    if (r.medianPriceUsd !== null) entry.prices.push(r.medianPriceUsd);
  }

  const result: HeatmapDistrictRow[] = [];
  for (const [district, data] of byDistrict) {
    const sorted = data.prices.sort((a, b) => a - b);
    result.push({
      district,
      listingCount: data.listings,
      medianPriceUsd: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null,
    });
  }

  return result.sort((a, b) => b.listingCount - a.listingCount);
}

/* ── Supply Signal Logic ─────────────────────────────────── */

function computeSupplySignal(
  rows: IndexRow[],
  dates: number[],
): "oversupply" | "squeeze" | "neutral" {
  if (dates.length < 14) return "neutral";

  // Compare recent 2 weeks vs prior 2 weeks
  const recentCutoff = dates[Math.max(0, dates.length - 14)];
  const priorCutoff = dates[Math.max(0, dates.length - 28)];

  const recent = rows.filter((r) => r.date.getTime() >= recentCutoff);
  const prior = rows.filter(
    (r) => r.date.getTime() >= priorCutoff && r.date.getTime() < recentCutoff,
  );

  if (recent.length === 0 || prior.length === 0) return "neutral";

  const recentCount = recent.reduce((s, r) => s + r.listingCount, 0);
  const priorCount = prior.reduce((s, r) => s + r.listingCount, 0);
  const recentMedian = weightedMedian(recent);
  const priorMedian = weightedMedian(prior);

  if (recentMedian === null || priorMedian === null) return "neutral";

  const countChange = (recentCount - priorCount) / Math.max(priorCount, 1);
  const priceChange = (recentMedian - priorMedian) / priorMedian;

  // Listing count up > 10% while median down > 2%
  if (countChange > 0.1 && priceChange < -0.02) return "oversupply";
  // Listing count down > 10% while median up > 2%
  if (countChange < -0.1 && priceChange > 0.02) return "squeeze";

  return "neutral";
}

/* ── Math Helpers ────────────────────────────────────────── */

export function weightedMedian(rows: IndexRow[]): number | null {
  const values: number[] = [];
  for (const r of rows) {
    if (r.medianPriceUsd !== null) {
      // Weight by listing count
      for (let i = 0; i < Math.max(r.listingCount, 1); i++) {
        values.push(r.medianPriceUsd);
      }
    }
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function weightedMean(rows: IndexRow[]): number | null {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const r of rows) {
    if (r.meanPriceUsd !== null) {
      const w = Math.max(r.listingCount, 1);
      weightedSum += r.meanPriceUsd * w;
      totalWeight += w;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

function weightedPercentile(
  rows: IndexRow[],
  field: "p25PriceUsd" | "p75PriceUsd",
): number | null {
  const values: number[] = [];
  for (const r of rows) {
    const v = r[field];
    if (v !== null) {
      for (let i = 0; i < Math.max(r.listingCount, 1); i++) {
        values.push(v);
      }
    }
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

function dailyWeightedMedians(rows: IndexRow[]): Map<number, number | null> {
  const byDate = new Map<number, IndexRow[]>();
  for (const r of rows) {
    const key = r.date.getTime();
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r);
  }

  const result = new Map<number, number | null>();
  for (const [ts, dayRows] of byDate) {
    result.set(ts, weightedMedian(dayRows));
  }
  return result;
}

function percentChange(
  dailyMedians: Map<number, number | null>,
  sortedDates: number[],
  daysAgo: number,
): number | null {
  if (sortedDates.length < 2) return null;
  const latest = dailyMedians.get(sortedDates[sortedDates.length - 1]);
  if (latest === null || latest === undefined) return null;

  // Find the date closest to `daysAgo` days ago
  const targetTs = sortedDates[sortedDates.length - 1] - daysAgo * 86400000;
  let closest: number | null = null;
  let closestDiff = Infinity;
  for (const d of sortedDates) {
    const diff = Math.abs(d - targetTs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = d;
    }
  }

  if (closest === null) return null;
  const old = dailyMedians.get(closest);
  if (old === null || old === undefined || old === 0) return null;
  return Math.round(((latest - old) / old) * 10000) / 100; // percentage with 2 decimals
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

function arrayMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function arrayMean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
