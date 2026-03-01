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
  "twin villa",
  // "villa" is matched via regex below to avoid "village" false positives
];

const TOWNHOUSE_KEYWORDS = ["townhouse", "town house", "link house"];

const HOUSE_KEYWORDS = [
  "house", "borey", "detached",
];

/** Match "villa" / "villas" as whole words, excluding "village". */
const VILLA_WORD_RE = /\bvillas?\b/i;

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
  // Regex match for standalone "villa"/"villas" (avoids "village" false positive)
  if (VILLA_WORD_RE.test(text)) return PropertyType.VILLA;
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

/* ── Title-only non-residential detector ─────────────────── */

/**
 * Strong non-residential signals that are safe to match even in
 * description text (highly specific phrases, not just single words
 * like "commercial" which appear in amenity/nearby-place text).
 */
const STRONG_NONRES_TITLE_KEYWORDS = [
  "warehouse for", "warehouse space",
  "factory for", "factory space",
  "workshop for", "workshop space",
  "office for rent", "office for sale", "office space for",
  "commercial property for", "commercial space for", "commercial building for",
  "retail shop for", "retail space for",
  "shophouse for", "shop house for",
  "restaurant for rent", "restaurant for sale",
  "hotel for rent", "hotel for sale",
  "guesthouse for", "guest house for",
  "land for rent", "land for sale", "plot for rent", "lot for rent",
];

/**
 * Check if a listing's TITLE alone contains strong non-residential signals.
 * More conservative than classifyPropertyType (only checks title, with
 * high-specificity phrases) — safe for bulk reclassification.
 */
export function isTitleNonResidential(title: string): boolean {
  const t = title.toLowerCase();
  return STRONG_NONRES_TITLE_KEYWORDS.some((kw) => t.includes(kw));
}

/**
 * Reclassify based on title + description with smarter context handling.
 * Returns the corrected PropertyType, or null if the listing is non-residential.
 *
 * Unlike classifyPropertyType, this function:
 * - Checks title for strong non-residential phrases first
 * - Then applies the standard classifier on title only (no description
 *   to avoid amenity false positives)
 */
export function reclassifyPropertyType(
  title: string,
  description?: string | null,
  urlSlug?: string | null
): PropertyType | null {
  // 1. Strong title-based non-residential check
  if (isTitleNonResidential(title)) return null;

  // 2. Standard classifier on title + URL slug
  const hint = `${title} ${urlSlug ?? ""}`;
  return classifyPropertyType(hint);
}
