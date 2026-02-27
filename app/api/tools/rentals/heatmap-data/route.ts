/**
 * GET /api/tools/rentals/heatmap-data
 *
 * Returns district-level aggregated data for the heatmap.
 * Prefers RentalIndexDaily; falls back to live RentalListing aggregation.
 * Admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    // Try index first
    const latestEntry = await prisma.rentalIndexDaily.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (latestEntry) {
      const rows = await prisma.rentalIndexDaily.findMany({
        where: { date: latestEntry.date },
        orderBy: { medianPriceUsd: "desc" },
        select: {
          district: true,
          city: true,
          bedrooms: true,
          propertyType: true,
          listingCount: true,
          medianPriceUsd: true,
          p25PriceUsd: true,
          p75PriceUsd: true,
        },
      });
      if (rows.length > 0) {
        return NextResponse.json(rows);
      }
    }

    // Fallback: aggregate from active listings
    const listings = await prisma.rentalListing.findMany({
      where: { isActive: true },
      select: {
        district: true,
        city: true,
        bedrooms: true,
        propertyType: true,
        priceMonthlyUsd: true,
      },
    });

    const groups = new Map<
      string,
      {
        district: string | null;
        city: string | null;
        bedrooms: number | null;
        propertyType: string;
        prices: number[];
      }
    >();

    for (const l of listings) {
      const key = `${l.district}|${l.propertyType}|${l.bedrooms}`;
      if (!groups.has(key)) {
        groups.set(key, {
          district: l.district,
          city: l.city,
          bedrooms: l.bedrooms,
          propertyType: l.propertyType || "Unknown",
          prices: [],
        });
      }
      if (l.priceMonthlyUsd !== null) groups.get(key)!.prices.push(l.priceMonthlyUsd);
    }

    const result = [];
    for (const g of groups.values()) {
      const sorted = g.prices.sort((a, b) => a - b);
      const median =
        sorted.length > 0
          ? sorted[Math.floor(sorted.length / 2)]
          : null;
      const p25 =
        sorted.length >= 4
          ? sorted[Math.floor(sorted.length * 0.25)]
          : null;
      const p75 =
        sorted.length >= 4
          ? sorted[Math.floor(sorted.length * 0.75)]
          : null;

      result.push({
        district: g.district,
        city: g.city,
        bedrooms: g.bedrooms,
        propertyType: g.propertyType,
        listingCount: sorted.length,
        medianPriceUsd: median,
        p25PriceUsd: p25,
        p75PriceUsd: p75,
      });
    }

    result.sort((a, b) => (b.medianPriceUsd ?? 0) - (a.medianPriceUsd ?? 0));
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
