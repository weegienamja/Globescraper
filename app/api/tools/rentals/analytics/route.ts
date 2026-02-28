/**
 * GET /api/tools/rentals/analytics
 *
 * Returns structured analytics data for the rental intelligence dashboard.
 * All calculations derive from RentalIndexDaily (pre-aggregated), never from live listings.
 *
 * Query params:
 *   city        – required, defaults to "Phnom Penh"
 *   district    – optional, filter to a single district
 *   bedrooms    – optional, filter to bedroom count
 *   propertyType – optional, CONDO | APARTMENT | OTHER
 *   range       – 30d | 90d | 180d | 365d (default: 90d)
 *   format      – json (default) | csv
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
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

const RANGE_DAYS: Record<string, number> = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const url = new URL(req.url);
    const city = url.searchParams.get("city") || "Phnom Penh";
    const district = url.searchParams.get("district") || undefined;
    const bedroomsParam = url.searchParams.get("bedrooms");
    const bedrooms = bedroomsParam ? parseInt(bedroomsParam, 10) : undefined;
    const propertyType = url.searchParams.get("propertyType") || undefined;
    const range = url.searchParams.get("range") || "90d";
    const format = url.searchParams.get("format") || "json";

    const days = RANGE_DAYS[range] ?? 90;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    // Build Prisma where clause
    const where: Record<string, unknown> = {
      city,
      date: { gte: since },
    };
    if (district) where.district = district;
    if (bedrooms !== undefined && !isNaN(bedrooms)) where.bedrooms = bedrooms;
    if (propertyType) where.propertyType = propertyType;

    const rawRows = await prisma.rentalIndexDaily.findMany({
      where,
      orderBy: { date: "asc" },
    });

    // Map to internal IndexRow type
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

    // Volatility score from all median values
    const allMedians = rows
      .map((r) => r.medianPriceUsd)
      .filter((v): v is number => v !== null);
    const volScore = volatilityScore(allMedians);

    // Fetch distinct districts for this city (so client dropdown updates)
    const districtRows = await prisma.rentalIndexDaily.findMany({
      where: { city, district: { not: null } },
      distinct: ["district"],
      select: { district: true },
      orderBy: { district: "asc" },
    });
    const availableDistricts = districtRows
      .map((r) => r.district)
      .filter((d): d is string => d !== null);

    const payload = {
      summary: {
        ...summary,
        volatilityScore: volScore,
      },
      trend,
      distribution,
      movers,
      heatmapDistricts,
      districts: availableDistricts,
      filters: { city, district, bedrooms, propertyType, range },
      meta: {
        rowCount: rows.length,
        dateRange: {
          from: rows.length > 0 ? rows[0].date.toISOString().slice(0, 10) : null,
          to: rows.length > 0 ? rows[rows.length - 1].date.toISOString().slice(0, 10) : null,
        },
      },
    };

    // CSV export
    if (format === "csv") {
      const csvLines = [
        "date,median,mean,p25,p75,listingCount,ma90",
        ...trend.map(
          (t) =>
            `${t.date},${t.median ?? ""},${t.mean ?? ""},${t.p25 ?? ""},${t.p75 ?? ""},${t.listingCount},${t.ma90 ?? ""}`,
        ),
      ];
      return new NextResponse(csvLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="rental-analytics-${city}-${range}.csv"`,
        },
      });
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
