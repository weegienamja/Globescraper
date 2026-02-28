/**
 * Property type classifier for rental listings.
 *
 * Determines whether a listing is a CONDO, APARTMENT, or OTHER
 * based on title and description keyword matching.
 */

import { PropertyType } from "@prisma/client";

/** Keywords that strongly indicate a rejection (house, villa, land, etc.) */
const REJECT_KEYWORDS = [
  "house", "villa", "villas", "land", "borey", "townhouse",
  "shophouse", "shop house", "commercial", "warehouse", "factory",
  "office space", "flat land", "plot", "lot for", "twin villa",
];

/** Keywords that strongly indicate PENTHOUSE */
const PENTHOUSE_KEYWORDS = [
  "penthouse",
];

/** Keywords that strongly indicate SERVICED_APARTMENT */
const SERVICED_APARTMENT_KEYWORDS = [
  "serviced apartment", "service apartment",
];

/** Keywords that strongly indicate CONDO */
const CONDO_KEYWORDS = [
  "condo", "condominium",
];

/** Keywords that strongly indicate APARTMENT */
const APARTMENT_KEYWORDS = [
  "apartment", "flat", "studio apartment", "studio",
];

/**
 * Classify a listing's property type based on title and description.
 *
 * Returns CONDO, APARTMENT, SERVICED_APARTMENT, PENTHOUSE, or OTHER.
 * OTHER should typically be skipped during ingestion.
 */
export function classifyPropertyType(
  title: string,
  description?: string | null
): PropertyType {
  const text = `${title} ${description ?? ""}`.toLowerCase();

  // Check rejection keywords first (these override)
  for (const kw of REJECT_KEYWORDS) {
    if (text.includes(kw)) {
      // But if it also mentions a positive type, let it through
      const hasPositive =
        PENTHOUSE_KEYWORDS.some((k) => text.includes(k)) ||
        SERVICED_APARTMENT_KEYWORDS.some((k) => text.includes(k)) ||
        CONDO_KEYWORDS.some((k) => text.includes(k)) ||
        APARTMENT_KEYWORDS.some((k) => text.includes(k));
      if (!hasPositive) return PropertyType.OTHER;
    }
  }

  // Check positive keywords (most-specific first)
  for (const kw of PENTHOUSE_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.PENTHOUSE;
  }
  for (const kw of SERVICED_APARTMENT_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.SERVICED_APARTMENT;
  }
  for (const kw of CONDO_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.CONDO;
  }
  for (const kw of APARTMENT_KEYWORDS) {
    if (text.includes(kw)) return PropertyType.APARTMENT;
  }

  return PropertyType.OTHER;
}

/**
 * Check whether a property type should be ingested (not OTHER for MVP).
 */
export function shouldIngest(type: PropertyType): boolean {
  return (
    type === PropertyType.CONDO ||
    type === PropertyType.APARTMENT ||
    type === PropertyType.SERVICED_APARTMENT ||
    type === PropertyType.PENTHOUSE
  );
}
