/**
 * Build Daily Index Job
 *
 * Aggregates RentalSnapshot data for a given date into RentalIndexDaily rows.
 * Computes median, mean, p25, p75 price statistics grouped by
 * city + district + bedrooms + propertyType.
 *
 * Default date: yesterday UTC.
 */

import { prisma } from "@/lib/prisma";
import { PropertyType } from "@prisma/client";

export interface BuildIndexOptions {
  /** The date to build the index for. Defaults to yesterday UTC. */
  date?: Date;
}

export interface BuildIndexResult {
  jobRunId: string;
  indexRows: number;
}

/**
 * Build or rebuild the daily rental index for the specified date.
 */
export async function buildDailyIndexJob(
  options?: BuildIndexOptions
): Promise<BuildIndexResult> {
  // Determine date (default = yesterday UTC at 00:00)
  const targetDate = options?.date ?? getYesterdayUTC();
  const dateStart = new Date(targetDate);
  dateStart.setUTCHours(0, 0, 0, 0);
  const dateEnd = new Date(dateStart);
  dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: "BUILD_INDEX",
      source: null,
      status: "SUCCESS",
      startedAt: new Date(),
    },
  });

  try {
    const startTime = Date.now();

    // Fetch all snapshots for the target date
    const snapshots = await prisma.rentalSnapshot.findMany({
      where: {
        scrapedAt: { gte: dateStart, lt: dateEnd },
        priceMonthlyUsd: { not: null },
      },
      select: {
        city: true,
        district: true,
        bedrooms: true,
        propertyType: true,
        priceMonthlyUsd: true,
      },
    });

    // Group by (city, district, bedrooms, propertyType)
    const groups = new Map<string, { prices: number[]; city: string; district: string | null; bedrooms: number | null; propertyType: PropertyType }>();

    for (const snap of snapshots) {
      if (snap.priceMonthlyUsd === null) continue;
      const key = `${snap.city}|${snap.district ?? ""}|${snap.bedrooms ?? ""}|${snap.propertyType}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          prices: [],
          city: snap.city,
          district: snap.district,
          bedrooms: snap.bedrooms,
          propertyType: snap.propertyType,
        };
        groups.set(key, group);
      }
      group.prices.push(snap.priceMonthlyUsd);
    }

    // Upsert into RentalIndexDaily
    let indexRows = 0;

    for (const group of groups.values()) {
      const sorted = group.prices.sort((a, b) => a - b);
      const count = sorted.length;
      if (count === 0) continue;

      const median = percentile(sorted, 0.5);
      const mean = sorted.reduce((a, b) => a + b, 0) / count;
      const p25 = percentile(sorted, 0.25);
      const p75 = percentile(sorted, 0.75);

      await prisma.rentalIndexDaily.upsert({
        where: {
          date_city_district_bedrooms_propertyType: {
            date: dateStart,
            city: group.city,
            district: group.district ?? "",
            bedrooms: group.bedrooms ?? -1,
            propertyType: group.propertyType,
          },
        },
        create: {
          date: dateStart,
          city: group.city,
          district: group.district,
          bedrooms: group.bedrooms,
          propertyType: group.propertyType,
          listingCount: count,
          medianPriceUsd: Math.round(median * 100) / 100,
          meanPriceUsd: Math.round(mean * 100) / 100,
          p25PriceUsd: Math.round(p25 * 100) / 100,
          p75PriceUsd: Math.round(p75 * 100) / 100,
        },
        update: {
          listingCount: count,
          medianPriceUsd: Math.round(median * 100) / 100,
          meanPriceUsd: Math.round(mean * 100) / 100,
          p25PriceUsd: Math.round(p25 * 100) / 100,
          p75PriceUsd: Math.round(p75 * 100) / 100,
        },
      });
      indexRows++;
    }

    const endTime = Date.now();

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "SUCCESS",
        endedAt: new Date(),
        durationMs: endTime - startTime,
        indexRowsCount: indexRows,
      },
    });

    return { jobRunId: jobRun.id, indexRows };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        durationMs: Date.now() - jobRun.startedAt.getTime(),
        errorMessage: msg.slice(0, 2000),
      },
    });
    return { jobRunId: jobRun.id, indexRows: 0 };
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

function getYesterdayUTC(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute a percentile from a sorted array of numbers.
 * Uses linear interpolation.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
