/**
 * GET /api/tools/rentals/listings/[id]/snapshots
 *
 * Returns all price snapshots for a single listing, ordered by scrapedAt desc.
 * Used by the expanded-row price history timeline in the ListingsTable.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  try {
    const snapshots = await prisma.rentalSnapshot.findMany({
      where: { listingId: id },
      orderBy: { scrapedAt: "desc" },
      select: {
        id: true,
        scrapedAt: true,
        priceMonthlyUsd: true,
        priceOriginal: true,
        propertyType: true,
        district: true,
        bedrooms: true,
      },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
