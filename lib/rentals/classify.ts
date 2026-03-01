/**
 * Property type classifier for rental listings.
 *
 * Determines the residential property type (CONDO, APARTMENT, HOUSE,
 * VILLA, etc.) based on title and description keyword matching.
 * Non-residential types (commercial, land, etc.) return null and
 * are rejected by shouldIngest().
 */

import { PropertyType } from "@prisma/client";

/* ── Keyword lists (most-specific first) ─────────────────── */

const PENTHOUSE_KEYWORDS = ["penthouse"];

const SERVICED_APARTMENT_KEYWORDS = [
  "serviced apartment", "service apartment",
];

const CONDO_KEYWORDS = ["condo", "condominium"];

const APARTMENT_KEYWORDS = [
  "apartment", "flat", "studio apartment", "studio",
];

const VILLA_KEYWORDS = [
  "twin villa", "villa", "villas",
];

const TOWNHOUSE_KEYWORDS = ["townhouse", "town house", "link house"];

const HOUSE_KEYWORDS = [
  "house", "borey", "detached",
];

/** Non-residential keywords — used to reject listings.
 *  Must be specific enough to avoid false-positives on amenity or
 *  nearby-place text (e.g. "near commercial area", "close to restaurants").
 */
const NON_RESIDENTIAL_KEYWORDS = [
  "shophouse", "shop house", "shop-house",
  "warehouse", "factory", "workshop",
  "office space", "office for rent", "office for sale", "co-working",
  "commercial space", "commercial property", "commercial building", "commercial for",
  "retail space", "retail shop", "retail for",
  "restaurant for", "hotel for", "guesthouse", "guest house",
  "flat land", "land for", "plot for", "lot for",
];

/**
 * Classify a listing's property type based on title and description.
 *
 * Returns one of the residential types: CONDO, APARTMENT,
 * SERVICED_APARTMENT, PENTHOUSE, HOUSE, VILLA, TOWNHOUSE.
 * Returns null for non-residential listings (commercial, land, etc.).
 */
export function classifyPropertyType(
  title: string,
  description?: string | null
): PropertyType | null {
  const text = `${title} ${description ?? ""}`.toLowerCase();

  // Reject non-residential types early
  for (const kw of NON_RESIDENTIAL_KEYWORDS) {
    if (text.includes(kw)) return null;
  }

  // Most-specific first to avoid false positives
  for (const kw of PENTHOUSE_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.PENTHOUSE;
  }
  for (const kw of SERVICED_APARTMENT_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.SERVICED_APARTMENT;
  }
  for (const kw of TOWNHOUSE_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.TOWNHOUSE;
  }
  for (const kw of VILLA_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.VILLA;
  }
  for (const kw of HOUSE_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.HOUSE;
  }
  for (const kw of CONDO_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.CONDO;
  }
  for (const kw of APARTMENT_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.APARTMENT;
  }

  // Default unclassified residential listing → APARTMENT
  return PropertyType.APARTMENT;
}

/**
 * Check whether a property type should be ingested.
 * Only residential types are accepted (null = non-residential → rejected).
 */
export function shouldIngest(type: PropertyType | null): boolean {
  return type !== null;
}
