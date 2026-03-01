import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { RentalResultsList } from "@/components/rentals/RentalResultsList";
import { RentalFilters } from "@/components/rentals/RentalFilters";
import { Pagination } from "@/components/rentals/Pagination";
import type { Prisma } from "@prisma/client";
import "./rentals.css";

export const metadata: Metadata = {
  title: "Properties to Rent",
  description: "Browse rental properties in Cambodia. Apartments, condos, houses and more.",
};

const PER_PAGE = 7;

interface SearchParams {
  page?: string;
  city?: string;
  district?: string;
  min?: string;
  max?: string;
  type?: string;
  beds?: string;
  maxBeds?: string;
  baths?: string;
  maxBaths?: string;
  sort?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function RentalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = buildWhere(sp);
  const orderBy = buildOrderBy(sp.sort);

  const [listings, total, cities, districts] = await Promise.all([
    prisma.rentalListing.findMany({
      where,
      select: {
        id: true,
        title: true,
        titleRewritten: true,
        city: true,
        district: true,
        propertyType: true,
        bedrooms: true,
        bathrooms: true,
        priceMonthlyUsd: true,
        imageUrlsJson: true,
        description: true,
        descriptionRewritten: true,
        postedAt: true,
        firstSeenAt: true,
      },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.rentalListing.count({ where }),
    prisma.rentalListing
      .findMany({ where: { isActive: true, NOT: { city: "" } }, select: { city: true }, distinct: ["city"], orderBy: { city: "asc" } })
      .then((rows) => rows.map((r) => r.city).filter((c): c is string => !!c)),
    prisma.rentalListing
      .findMany({ where: { isActive: true, NOT: { district: "" } }, select: { district: true }, distinct: ["district"], orderBy: { district: "asc" } })
      .then((rows) => rows.map((r) => r.district).filter((d): d is string => !!d)),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filterSummary = buildFilterSummary(sp, total);

  function buildHref(p: number): string {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (sp.city) params.set("city", sp.city);
    if (sp.district) params.set("district", sp.district);
    if (sp.type) params.set("type", sp.type);
    if (sp.beds) params.set("beds", sp.beds);
    if (sp.maxBeds) params.set("maxBeds", sp.maxBeds);
    if (sp.min) params.set("min", sp.min);
    if (sp.max) params.set("max", sp.max);
    if (sp.baths) params.set("baths", sp.baths);
    if (sp.maxBaths) params.set("maxBaths", sp.maxBaths);
    if (sp.sort) params.set("sort", sp.sort);
    return `/rentals?${params.toString()}`;
  }

  return (
    <main className="rentals-page">
      <header className="rentals-page__header">
        <h1 className="rentals-page__title">Properties to Rent</h1>
        <p className="rentals-page__count">{filterSummary}</p>
      </header>

      <Suspense fallback={null}>
        <RentalFilters cities={cities} districts={districts} />
      </Suspense>

      <RentalResultsList listings={listings} />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={buildHref}
      />
    </main>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function buildWhere(sp: SearchParams): Prisma.RentalListingWhereInput {
  const where: Prisma.RentalListingWhereInput = { isActive: true };

  if (sp.city) where.city = sp.city;
  if (sp.district) where.district = sp.district;

  if (sp.type) {
    where.propertyType = sp.type as Prisma.RentalListingWhereInput["propertyType"];
  }

  /* beds range */
  const minBeds = sp.beds ? parseInt(sp.beds, 10) : null;
  const maxBeds = sp.maxBeds ? parseInt(sp.maxBeds, 10) : null;
  if (minBeds != null || maxBeds != null) {
    where.bedrooms = {};
    if (minBeds != null && !isNaN(minBeds)) where.bedrooms.gte = minBeds;
    if (maxBeds != null && !isNaN(maxBeds)) where.bedrooms.lte = maxBeds;
  }

  /* baths range */
  const minBaths = sp.baths ? parseInt(sp.baths, 10) : null;
  const maxBaths = sp.maxBaths ? parseInt(sp.maxBaths, 10) : null;
  if (minBaths != null || maxBaths != null) {
    where.bathrooms = {};
    if (minBaths != null && !isNaN(minBaths)) where.bathrooms.gte = minBaths;
    if (maxBaths != null && !isNaN(maxBaths)) where.bathrooms.lte = maxBaths;
  }

  /* price range */
  const minPrice = sp.min ? parseFloat(sp.min) : null;
  const maxPrice = sp.max ? parseFloat(sp.max) : null;
  if (minPrice != null || maxPrice != null) {
    where.priceMonthlyUsd = {};
    if (minPrice != null) where.priceMonthlyUsd.gte = minPrice;
    if (maxPrice != null) where.priceMonthlyUsd.lte = maxPrice;
  }

  return where;
}

function buildOrderBy(sort?: string): Prisma.RentalListingOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ priceMonthlyUsd: "asc" }];
    case "price_desc":
      return [{ priceMonthlyUsd: "desc" }];
    case "beds_desc":
      return [{ bedrooms: "desc" }, { lastSeenAt: "desc" }];
    default:
      return [{ lastSeenAt: "desc" }, { firstSeenAt: "desc" }];
  }
}

function buildFilterSummary(
  sp: { city?: string; district?: string; type?: string },
  total: number,
): string {
  const parts: string[] = [];
  if (sp.city) parts.push(sp.city);
  if (sp.district) parts.push(sp.district);
  if (sp.type) parts.push(sp.type.replace(/_/g, " ").toLowerCase());
  const suffix = parts.length > 0 ? ` in ${parts.join(", ")}` : "";
  return `${total.toLocaleString()} result${total !== 1 ? "s" : ""}${suffix}`;
}
