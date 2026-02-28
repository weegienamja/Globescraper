/**
 * Build Monthly Index Job
 *
 * Aggregates RentalIndexDaily rows into RentalIndexMonthly.
 * Designed to run once per month (e.g. 1st of month for previous month).
 *
 * For each (city, district, bedrooms, propertyType) combination,
 * computes the aggregate median, mean, p25, p75, and total listing count
 * across all daily rows in that month.
 *
 * Usage: npx tsx scripts/build-monthly-index.ts [YYYY-MM]
 */

import { prisma } from "@/lib/prisma";

interface BuildMonthlyOptions {
  /** "YYYY-MM" format. Defaults to previous month. */
  yearMonth?: string;
}

interface BuildMonthlyResult {
  yearMonth: string;
  rowsUpserted: number;
  dailyRowsProcessed: number;
}

export async function buildMonthlyIndexJob(
  options?: BuildMonthlyOptions,
): Promise<BuildMonthlyResult> {
  const ym = options?.yearMonth ?? getPreviousMonth();
  const [year, month] = ym.split("-").map(Number);

  const dateStart = new Date(Date.UTC(year, month - 1, 1));
  const dateEnd = new Date(Date.UTC(year, month, 1));

  console.log(`[monthly-index] Building for ${ym} (${dateStart.toISOString()} to ${dateEnd.toISOString()})`);

  const dailyRows = await prisma.rentalIndexDaily.findMany({
    where: {
      date: { gte: dateStart, lt: dateEnd },
    },
  });

  console.log(`[monthly-index] Found ${dailyRows.length} daily index rows`);

  // Group by (city, district, bedrooms, propertyType)
  const groups = new Map<
    string,
    {
      city: string;
      district: string | null;
      bedrooms: number | null;
      propertyType: string;
      medians: number[];
      means: number[];
      p25s: number[];
      p75s: number[];
      counts: number[];
    }
  >();

  for (const row of dailyRows) {
    const key = `${row.city}|${row.district ?? ""}|${row.bedrooms ?? ""}|${row.propertyType}`;
    if (!groups.has(key)) {
      groups.set(key, {
        city: row.city,
        district: row.district,
        bedrooms: row.bedrooms,
        propertyType: row.propertyType,
        medians: [],
        means: [],
        p25s: [],
        p75s: [],
        counts: [],
      });
    }
    const g = groups.get(key)!;
    if (row.medianPriceUsd !== null) g.medians.push(row.medianPriceUsd);
    if (row.meanPriceUsd !== null) g.means.push(row.meanPriceUsd);
    if (row.p25PriceUsd !== null) g.p25s.push(row.p25PriceUsd);
    if (row.p75PriceUsd !== null) g.p75s.push(row.p75PriceUsd);
    g.counts.push(row.listingCount);
  }

  let rowsUpserted = 0;

  for (const group of groups.values()) {
    const medianRent = avg(group.medians);
    const meanRent = avg(group.means);
    const p25Rent = avg(group.p25s);
    const p75Rent = avg(group.p75s);
    const listingCount = Math.round(avg(group.counts) ?? 0);

    await prisma.rentalIndexMonthly.upsert({
      where: {
        yearMonth_city_district_bedrooms_propertyType: {
          yearMonth: ym,
          city: group.city,
          district: group.district ?? "",
          bedrooms: group.bedrooms ?? -1,
          propertyType: group.propertyType as "CONDO" | "APARTMENT" | "OTHER",
        },
      },
      create: {
        yearMonth: ym,
        city: group.city,
        district: group.district,
        bedrooms: group.bedrooms,
        propertyType: group.propertyType as "CONDO" | "APARTMENT" | "OTHER",
        listingCount,
        medianRent: medianRent !== null ? round2(medianRent) : null,
        meanRent: meanRent !== null ? round2(meanRent) : null,
        p25Rent: p25Rent !== null ? round2(p25Rent) : null,
        p75Rent: p75Rent !== null ? round2(p75Rent) : null,
      },
      update: {
        listingCount,
        medianRent: medianRent !== null ? round2(medianRent) : null,
        meanRent: meanRent !== null ? round2(meanRent) : null,
        p25Rent: p25Rent !== null ? round2(p25Rent) : null,
        p75Rent: p75Rent !== null ? round2(p75Rent) : null,
      },
    });
    rowsUpserted++;
  }

  console.log(`[monthly-index] Upserted ${rowsUpserted} monthly rows for ${ym}`);

  return {
    yearMonth: ym,
    rowsUpserted,
    dailyRowsProcessed: dailyRows.length,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function getPreviousMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ── CLI entry point ─────────────────────────────────────── */

if (require.main === module || process.argv[1]?.endsWith("build-monthly-index.ts")) {
  const ym = process.argv[2]; // optional YYYY-MM argument
  buildMonthlyIndexJob(ym ? { yearMonth: ym } : undefined)
    .then((result) => {
      console.log("[monthly-index] Done:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[monthly-index] Failed:", err);
      process.exit(1);
    });
}
