/**
 * /tools/rentals/analytics — Rental Market Analytics Dashboard
 *
 * Server component that prefetches the default analytics payload
 * and renders the client-side interactive dashboard.
 * Admin-only.
 */

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeKpi,
  computeTrend,
  computeDistribution,
  computeMovers,
  computeDistrictHeatmap,
  type IndexRow,
} from "@/lib/analytics/calculateStats";
import { volatilityScore } from "@/lib/analytics/volatility";
import { AnalyticsDashboardClient } from "@/components/analytics/AnalyticsDashboardClient";

export const revalidate = 0;

export default async function AnalyticsPage() {
  await requireAdmin();

  // Default: 90 days, Phnom Penh, all districts
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  since.setUTCHours(0, 0, 0, 0);

  const rawRows = await prisma.rentalIndexDaily.findMany({
    where: {
      city: "Phnom Penh",
      date: { gte: since },
    },
    orderBy: { date: "asc" },
  });

  const rows: IndexRow[] = rawRows.map((r) => ({
    date: r.date,
    city: r.city,
    district: r.district,
    bedrooms: r.bedrooms,
    propertyType: r.propertyType,
    listingCount: r.listingCount,
    medianPriceUsd: r.medianPriceUsd,
    meanPriceUsd: r.meanPriceUsd,
    p25PriceUsd: r.p25PriceUsd,
    p75PriceUsd: r.p75PriceUsd,
  }));

  const summary = computeKpi(rows);
  const trend = computeTrend(rows);
  const distribution = computeDistribution(rows);
  const movers = computeMovers(rows);
  const heatmapDistricts = computeDistrictHeatmap(rows);

  const allMedians = rows
    .map((r) => r.medianPriceUsd)
    .filter((v): v is number => v !== null);

  const initialData = {
    summary: { ...summary, volatilityScore: volatilityScore(allMedians) },
    trend,
    distribution,
    movers,
    heatmapDistricts,
    filters: {
      city: "Phnom Penh",
      range: "90d",
    },
    meta: {
      rowCount: rows.length,
      dateRange: {
        from: rows.length > 0 ? rows[0].date.toISOString().slice(0, 10) : null,
        to: rows.length > 0 ? rows[rows.length - 1].date.toISOString().slice(0, 10) : null,
      },
    },
  };

  // Get distinct districts for the filter dropdown
  const districtRows = await prisma.rentalIndexDaily.findMany({
    where: { city: "Phnom Penh", district: { not: null } },
    distinct: ["district"],
    select: { district: true },
    orderBy: { district: "asc" },
  });
  const districts = districtRows
    .map((r) => r.district)
    .filter((d): d is string => d !== null);

  return <AnalyticsDashboardClient initialData={initialData} districts={districts} />;
}
