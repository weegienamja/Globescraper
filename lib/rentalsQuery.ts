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
 *   f_*          -> amenitiesJson contains (advanced, must-haves)
 */

import type { Prisma } from "@prisma/client";
import {
  FILTERABLE_FACILITIES,
  FILTERABLE_AMENITIES,
} from "@/lib/amenityClassification";

/**
 * Convert a human amenity name like "Swimming Pool" to a URL-safe
 * param key like "f_swimmingPool".  Must match the same function in
 * RentalFilters.tsx.
 */
function amenityKey(name: string): string {
  const camel = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  return `f_${camel}`;
}

/** Map from URL param key -> original amenity name for Prisma contains check. */
const AMENITY_PARAM_MAP: Record<string, string> = {};
for (const name of [...FILTERABLE_FACILITIES, ...FILTERABLE_AMENITIES]) {
  AMENITY_PARAM_MAP[amenityKey(name)] = name;
}

/** All amenity/facility param keys (f_swimmingPool, f_gym, …) */
export const AMENITY_PARAM_KEYS = Object.keys(AMENITY_PARAM_MAP);

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
  // Amenity / facility must-haves (dynamic f_* keys)
  [key: string]: string | undefined;
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
  ...AMENITY_PARAM_KEYS,
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

  // Amenity / facility must-haves: each active f_* param requires
  // the amenitiesJson text column to contain the amenity name.
  const amenityConditions: Prisma.RentalListingWhereInput[] = [];
  for (const key of AMENITY_PARAM_KEYS) {
    if (sp[key] === "1") {
      const name = AMENITY_PARAM_MAP[key];
      if (name) {
        amenityConditions.push({ amenitiesJson: { contains: name } });
      }
    }
  }
  if (amenityConditions.length > 0) {
    where.AND = amenityConditions;
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
