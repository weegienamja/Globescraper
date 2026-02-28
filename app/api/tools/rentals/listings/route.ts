/**
 * GET /api/tools/rentals/listings
 *
 * Paginated list of scraped rental listings.
 * Query params: page, limit, source, propertyType, search, sort, order
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma, RentalSource } from "@prisma/client";
import { reverseDistrictAliases } from "@/lib/rentals/district-geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
    const source = url.searchParams.get("source") || undefined;
    const propertyType = url.searchParams.get("propertyType") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const districtParam = url.searchParams.get("district") || undefined;
    const sort = url.searchParams.get("sort") || "lastSeenAt";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

    const where: Prisma.RentalListingWhereInput = {};
    if (source && Object.values(RentalSource).includes(source as RentalSource)) {
      where.source = source as RentalSource;
    }
    if (propertyType && (propertyType === "CONDO" || propertyType === "APARTMENT")) {
      where.propertyType = propertyType;
    }
    if (districtParam) {
      // Use reverse alias lookup to find all DB district values
      // that normalise to this canonical name
      const aliases = reverseDistrictAliases(districtParam);
      where.district = { in: aliases };
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { district: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const allowedSorts = ["lastSeenAt", "firstSeenAt", "priceMonthlyUsd", "title", "district", "sizeSqm", "postedAt"];
    const sortField = allowedSorts.includes(sort) ? sort : "lastSeenAt";

    const [listings, total] = await Promise.all([
      prisma.rentalListing.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          source: true,
          title: true,
          canonicalUrl: true,
          city: true,
          district: true,
          propertyType: true,
          bedrooms: true,
          bathrooms: true,
          sizeSqm: true,
          priceMonthlyUsd: true,
          priceOriginal: true,
          firstSeenAt: true,
          lastSeenAt: true,
          isActive: true,
          imageUrlsJson: true,
          amenitiesJson: true,
          postedAt: true,
          _count: { select: { snapshots: true } },
        },
      }),
      prisma.rentalListing.count({ where }),
    ]);

    return NextResponse.json({
      listings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
