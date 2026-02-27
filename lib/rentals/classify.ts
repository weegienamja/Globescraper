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
  "penthouse",
];

/** Keywords that strongly indicate CONDO */
const CONDO_KEYWORDS = [
  "condo", "condominium",
];

/** Keywords that strongly indicate APARTMENT */
const APARTMENT_KEYWORDS = [
  "apartment", "flat", "service apartment", "serviced apartment",
  "studio apartment", "studio",
];

/**
 * Classify a listing's property type based on title and description.
 *
 * Returns CONDO, APARTMENT, or OTHER.
 * OTHER should typically be skipped during ingestion for MVP.
 */
export function classifyPropertyType(
  title: string,
  description?: string | null
): PropertyType {
  const text = `${title} ${description ?? ""}`.toLowerCase();

  // Check rejection keywords first (these override)
  for (const kw of REJECT_KEYWORDS) {
    if (text.includes(kw)) {
      // But if it also mentions condo/apartment, check which signal is stronger
      const hasCondo = CONDO_KEYWORDS.some((k) => text.includes(k));
      const hasApartment = APARTMENT_KEYWORDS.some((k) => text.includes(k));
      if (!hasCondo && !hasApartment) return PropertyType.OTHER;
    }
  }

  // Check positive keywords
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
  return type === PropertyType.CONDO || type === PropertyType.APARTMENT;
}
