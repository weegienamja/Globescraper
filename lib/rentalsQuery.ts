/**
 * lib/rentalsQuery.ts
 *
 * Shared helpers that convert URL search params into Prisma
 * `where` and `orderBy` clauses for the public /rentals page.
 *
 * Query param mapping:
 *   city         -> RentalListing.city (exact match)
 *   district     -> RentalListing.district (exact match)
 *   minPrice     -> RentalListing.priceMonthlyUsd >= N
 *   maxPrice     -> RentalListing.priceMonthlyUsd <= N
 *   bedsMin      -> RentalListing.bedrooms >= N
 *   propertyType -> RentalListing.propertyType (exact enum)
 *   sort         -> orderBy clause
 *   bathsMin     -> RentalListing.bathrooms >= N  (advanced)
 *   bathsMax     -> RentalListing.bathrooms <= N  (advanced)
 *   sizeMin      -> RentalListing.sizeSqm >= N    (advanced)
 *   sizeMax      -> RentalListing.sizeSqm <= N    (advanced)
 *   dateAdded    -> RentalListing.firstSeenAt >= cutoff (advanced)
 *   available    -> RentalListing.isActive = true  (advanced, default anyway)
 *   photos       -> imageUrlsJson is non-empty JSON array (advanced)
 *   geo          -> latitude AND longitude not null (advanced)
 */

import type { Prisma } from "@prisma/client";

export interface RentalSearchParams {
  page?: string;
  city?: string;
  district?: string;
  minPrice?: string;
  maxPrice?: string;
  bedsMin?: string;
  propertyType?: string;
  sort?: string;
  // Advanced
  bathsMin?: string;
  bathsMax?: string;
  sizeMin?: string;
  sizeMax?: string;
  dateAdded?: string;
  available?: string;
  photos?: string;
  geo?: string;
}

/**
 * All URL param keys that belong to the "advanced" panel.
 * Used both for counting active advanced filters and for the
 * "Clear Advanced" action.
 */
export const ADVANCED_PARAM_KEYS = [
  "bathsMin",
  "bathsMax",
  "sizeMin",
  "sizeMax",
  "dateAdded",
  "available",
  "photos",
  "geo",
] as const;

/** Every param key the filter system writes to the URL. */
export const ALL_PARAM_KEYS = [
  "city",
  "district",
  "minPrice",
  "maxPrice",
  "bedsMin",
  "propertyType",
  "sort",
  ...ADVANCED_PARAM_KEYS,
  "page",
] as const;

/* ------------------------------------------------------------------ */
/*  WHERE                                                              */
/* ------------------------------------------------------------------ */

export function buildRentalsWhere(
  sp: RentalSearchParams,
): Prisma.RentalListingWhereInput {
  const where: Prisma.RentalListingWhereInput = { isActive: true };

  // -- Quick filters ---------------------------------------------------

  if (sp.city) where.city = sp.city;
  if (sp.district) where.district = sp.district;

  if (sp.propertyType) {
    where.propertyType =
      sp.propertyType as Prisma.RentalListingWhereInput["propertyType"];
  }

  // bedsMin: single "N+" selector  ->  bedrooms >= N
  const bedsMin = safeInt(sp.bedsMin);
  if (bedsMin !== null) where.bedrooms = { gte: bedsMin };

  // Price range
  const minPrice = safeFloat(sp.minPrice);
  const maxPrice = safeFloat(sp.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    where.priceMonthlyUsd = {
      ...(minPrice !== null ? { gte: minPrice } : {}),
      ...(maxPrice !== null ? { lte: maxPrice } : {}),
    };
  }

  // -- Advanced filters ------------------------------------------------

  // Bathrooms range
  const bathsMin = safeInt(sp.bathsMin);
  const bathsMax = safeInt(sp.bathsMax);
  if (bathsMin !== null || bathsMax !== null) {
    where.bathrooms = {
      ...(bathsMin !== null ? { gte: bathsMin } : {}),
      ...(bathsMax !== null ? { lte: bathsMax } : {}),
    };
  }

  // Size (sqm) range
  const sizeMin = safeFloat(sp.sizeMin);
  const sizeMax = safeFloat(sp.sizeMax);
  if (sizeMin !== null || sizeMax !== null) {
    where.sizeSqm = {
      ...(sizeMin !== null ? { gte: sizeMin } : {}),
      ...(sizeMax !== null ? { lte: sizeMax } : {}),
    };
  }

  // dateAdded: restrict to listings first seen within the window
  const cutoff = dateCutoff(sp.dateAdded);
  if (cutoff) {
    where.firstSeenAt = { gte: cutoff };
  }

  // photos=1: imageUrlsJson parses to a non-empty array.
  // We approximate this with a simple "contains at least one URL" check.
  if (sp.photos === "1") {
    where.imageUrlsJson = { contains: "http" };
  }

  // geo=1: latitude and longitude both present
  if (sp.geo === "1") {
    where.latitude = { not: null };
    where.longitude = { not: null };
  }

  return where;
}

/* ------------------------------------------------------------------ */
/*  ORDER BY                                                           */
/* ------------------------------------------------------------------ */

export function buildRentalsOrderBy(
  sort?: string,
): Prisma.RentalListingOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ firstSeenAt: "desc" }];
    case "updated":
      return [{ lastSeenAt: "desc" }];
    case "price_asc":
      return [{ priceMonthlyUsd: "asc" }];
    case "price_desc":
      return [{ priceMonthlyUsd: "desc" }];
    case "size_desc":
      return [{ sizeSqm: "desc" }];
    default:
      // Default: newest listed
      return [{ firstSeenAt: "desc" }];
  }
}

/* ------------------------------------------------------------------ */
/*  Filter summary line                                                */
/* ------------------------------------------------------------------ */

export function buildFilterSummary(
  sp: RentalSearchParams,
  total: number,
): string {
  const parts: string[] = [];
  if (sp.city) parts.push(sp.city);
  if (sp.district) parts.push(sp.district);
  if (sp.propertyType)
    parts.push(sp.propertyType.replace(/_/g, " ").toLowerCase());
  const suffix = parts.length > 0 ? ` in ${parts.join(", ")}` : "";
  return `${total.toLocaleString()} result${total !== 1 ? "s" : ""}${suffix}`;
}

/* ------------------------------------------------------------------ */
/*  Pagination href builder                                            */
/* ------------------------------------------------------------------ */

export function buildPaginationHref(
  sp: RentalSearchParams,
  page: number,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  // Preserve every non-empty param
  for (const key of ALL_PARAM_KEYS) {
    if (key === "page") continue;
    const val = sp[key as keyof RentalSearchParams];
    if (val) params.set(key, val);
  }
  return `/rentals?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function safeInt(v?: string): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function safeFloat(v?: string): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * Convert a dateAdded token (e.g. "24h", "7d", "1m") to a Date cutoff.
 * Returns null for "anytime" or unknown values.
 */
function dateCutoff(token?: string): Date | null {
  if (!token || token === "anytime") return null;
  const now = Date.now();
  const hours: Record<string, number> = {
    "24h": 24,
    "3d": 72,
    "7d": 168,
    "14d": 336,
    "1m": 730,
  };
  const h = hours[token];
  if (!h) return null;
  return new Date(now - h * 3600_000);
}
