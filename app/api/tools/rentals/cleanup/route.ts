/**
 * POST /api/tools/rentals/cleanup
 *
 * Admin-only endpoint that fixes existing listing data:
 * - Strips breadcrumb prefixes from district field (e.g. "Rent>Siem Reap>..." → last segment)
 * - Detects city from district breadcrumb text and updates city field
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";
import { parseDistrict, parseCity } from "@/lib/rentals/parse";

export async function POST() {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    // Get all listings
    const listings = await prisma.rentalListing.findMany({
      select: { id: true, district: true, city: true },
    });

    let fixed = 0;

    for (const listing of listings) {
      const raw = listing.district;
      if (!raw) continue;

      // Check if it contains breadcrumb separators
      const needsFix = raw.includes(">");

      if (needsFix) {
        const newDistrict = parseDistrict(raw);
        const newCity = parseCity(raw);

        await prisma.rentalListing.update({
          where: { id: listing.id },
          data: {
            district: newDistrict,
            city: newCity,
          },
        });

        // Also fix associated snapshots
        await prisma.rentalSnapshot.updateMany({
          where: { listingId: listing.id },
          data: {
            district: newDistrict,
            city: newCity,
          },
        });

        fixed++;
      }
    }

    return NextResponse.json({
      total: listings.length,
      fixed,
      message: `Fixed ${fixed} listings with breadcrumb-style districts`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
