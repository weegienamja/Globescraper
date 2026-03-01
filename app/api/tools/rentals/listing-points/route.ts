/**
 * GET /api/tools/rentals/listing-points
 *
 * Returns individual listing coordinates for the heatmap point layer.
 * Only includes active listings with valid lat/lng.
 * Admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const listings = await prisma.rentalListing.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        title: true,
        district: true,
        propertyType: true,
        bedrooms: true,
        priceMonthlyUsd: true,
        source: true,
      },
      orderBy: { priceMonthlyUsd: "asc" },
    });

    return NextResponse.json(listings);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
