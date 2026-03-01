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
import { Prisma, PropertyType, RentalSource } from "@prisma/client";
import { reverseDistrictAliases } from "@/lib/rentals/district-geo";

/** Maps the virtual "LONG_TERM_RENTAL" filter to the underlying enum values. */
const LONG_TERM_RENTAL_TYPES: PropertyType[] = ["VILLA", "TOWNHOUSE"];

const ALLOWED_PROPERTY_TYPES = new Set<string>([
  ...Object.values(PropertyType),
  "LONG_TERM_RENTAL",
]);

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
    const aiStatus = url.searchParams.get("aiStatus") || undefined;
    const sort = url.searchParams.get("sort") || "lastSeenAt";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

    const where: Prisma.RentalListingWhereInput = {};
    if (source && Object.values(RentalSource).includes(source as RentalSource)) {
      where.source = source as RentalSource;
    }
    if (propertyType && ALLOWED_PROPERTY_TYPES.has(propertyType)) {
      if (propertyType === "LONG_TERM_RENTAL") {
        where.propertyType = { in: LONG_TERM_RENTAL_TYPES };
      } else {
        where.propertyType = propertyType as PropertyType;
      }
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
    // AI status filter
    if (aiStatus === "reviewed") {
      where.aiReviews = { some: {} };
    } else if (aiStatus === "unreviewed") {
      where.aiReviews = { none: {} };
    } else if (aiStatus === "flagged") {
      where.aiReviews = { some: { flagged: true } };
    } else if (aiStatus === "rewritten") {
      where.descriptionRewritten = { not: null };
    } else if (aiStatus === "unrewritten") {
      where.descriptionRewritten = null;
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
          descriptionRewritten: true,
          descriptionRewrittenAt: true,
          titleRewritten: true,
          _count: { select: { snapshots: true } },
          snapshots: {
            orderBy: { scrapedAt: "desc" as const },
            take: 20,
            select: {
              id: true,
              scrapedAt: true,
              priceMonthlyUsd: true,
              priceOriginal: true,
            },
          },
          aiReviews: {
            orderBy: { reviewedAt: "desc" as const },
            take: 1,
            select: {
              id: true,
              reviewedAt: true,
              suggestedType: true,
              isResidential: true,
              confidence: true,
              reason: true,
              flagged: true,
            },
          },
        },
      }),
      prisma.rentalListing.count({ where }),
    ]);

    // Derive price-change metadata per listing
    const enriched = listings.map((l) => {
      const snaps = l.snapshots;
      const prices = snaps
        .map((s) => s.priceMonthlyUsd)
        .filter((p): p is number => p !== null);
      const uniquePrices = [...new Set(prices)];
      const hasPriceChange = uniquePrices.length > 1;
      const latestPrice = prices[0] ?? null;
      const previousPrice = prices.length > 1 ? prices[1] : null;
      const priceDirection =
        latestPrice !== null && previousPrice !== null
          ? latestPrice > previousPrice
            ? "up"
            : latestPrice < previousPrice
              ? "down"
              : "same"
          : null;

      return {
        ...l,
        aiReview: l.aiReviews[0] ?? null,
        priceChange: {
          hasPriceChange,
          latestPrice,
          previousPrice,
          priceDirection,
          uniquePriceCount: uniquePrices.length,
        },
      };
    });

    return NextResponse.json({
      listings: enriched,
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
