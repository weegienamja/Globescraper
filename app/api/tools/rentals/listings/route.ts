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
import { Prisma } from "@prisma/client";

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
    const sort = url.searchParams.get("sort") || "lastSeenAt";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

    const where: Prisma.RentalListingWhereInput = {};
    if (source && (source === "KHMER24" || source === "REALESTATE_KH")) {
      where.source = source;
    }
    if (propertyType && (propertyType === "CONDO" || propertyType === "APARTMENT")) {
      where.propertyType = propertyType;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { district: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const allowedSorts = ["lastSeenAt", "firstSeenAt", "priceMonthlyUsd", "title", "district"];
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
