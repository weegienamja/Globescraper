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

/* ── Description headline scanner ────────────────────────── */

/**
 * Many realestate.com.kh listings use a generic title ("Apartment for Rent")
 * but reveal the true property type in the first line of the description
 * (e.g. "Warehouse for Rent at Chhouk Va 2"). This function scans just the
 * opening ~200 characters of the description — essentially the "headline" —
 * for strong non-residential signals without scanning the full body where
 * amenity text like "near commercial area" would cause false positives.
 *
 * Returns the detected non-residential type keyword, or null if none found.
 */
/** Regex-based non-residential headline patterns.
 *  "land/plot/lot" intentionally omitted — too many false positives from
 *  building names like "Park Land for rent". Those are caught by the
 *  title-based STRONG_NONRES_TITLE_KEYWORDS instead.
 */
const DESC_HEADLINE_NONRES: RegExp[] = [
  /\bwarehouse\s+for\s+(?:rent|sale|lease)\b/i,
  /\bfactory\s+for\s+(?:rent|sale)\b/i,
  /\bworkshop\s+for\s+(?:rent|sale)\b/i,
  /\boffice\s+(?:for\s+(?:rent|sale)|space\s+for\s+rent)\b/i,
  /\bcommercial\s+(?:for\s+(?:rent|sale)|property\s+for|space\s+for)\b/i,
  /\bshop\s*house\s+for\s+(?:rent|sale)\b/i,
  /\bretail\s+(?:for\s+(?:rent|sale)|space\s+for\s+rent)\b/i,
  /\brestaurant\s+for\s+(?:rent|sale)\b/i,
  /\bhotel\s+for\s+(?:rent|sale)\b/i,
  /\bguest\s*house\s+for\s+(?:rent|sale)\b/i,
];

/**
 * Scan the first ~200 chars of description for non-residential headline.
 * Only checks the opening "headline" section to avoid amenity false positives.
 */
export function isDescriptionHeadlineNonResidential(description: string | null | undefined): boolean {
  if (!description) return false;

  // Take just the first ~200 chars — the "headline" portion.
  // Split on newlines and take the first meaningful line(s).
  const lines = description.split(/[\n\r]+/).filter(l => l.trim().length > 0);
  const headline = lines.slice(0, 3).join(" ").toLowerCase().slice(0, 300);

  // Check for strong non-residential signals in the headline
  return DESC_HEADLINE_NONRES.some((re) => re.test(headline));
}

/**
 * Full description-aware classification. Checks:
 * 1. Title for strong non-residential phrases
 * 2. Description headline (first ~200 chars) for non-residential signals
 * 3. Standard classifier on title + URL slug for residential type
 *
 * Also detects type corrections: if title says "Apartment" but description
 * headline says "Villa for Rent", the description wins.
 */
const DESC_HEADLINE_TYPE_PATTERNS: Array<{ re: RegExp; type: PropertyType }> = [
  { re: /\bpenthouse\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.PENTHOUSE },
  { re: /\bserviced?\s+apartment\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.SERVICED_APARTMENT },
  { re: /\btown\s*house\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.TOWNHOUSE },
  { re: /\bvillas?\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.VILLA },
  { re: /\bhouse\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.HOUSE },
  { re: /\bcondo(?:minium)?\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.CONDO },
  { re: /\bapartment\s+for\s+(?:rent|sale|lease)/i, type: PropertyType.APARTMENT },
];

/**
 * Extract the real property type from the description headline if it
 * contradicts the title. Returns null if no clear type is found.
 */
export function getDescriptionHeadlineType(description: string | null | undefined): PropertyType | null {
  if (!description) return null;
  const lines = description.split(/[\n\r]+/).filter(l => l.trim().length > 0);
  const headline = lines.slice(0, 3).join(" ").slice(0, 300);

  for (const { re, type } of DESC_HEADLINE_TYPE_PATTERNS) {
    if (re.test(headline)) return type;
  }
  return null;
}

/**
 * Reclassify based on title + description with smarter context handling.
 * Returns the corrected PropertyType, or null if the listing is non-residential.
 *
 * This function:
 * 1. Checks title for strong non-residential phrases
 * 2. Checks description headline for non-residential signals
 * 3. Checks if description headline reveals a different residential type
 * 4. Falls back to standard title + URL classifier
 */
export function reclassifyPropertyType(
  title: string,
  description?: string | null,
  urlSlug?: string | null
): PropertyType | null {
  // 1. Strong title-based non-residential check
  if (isTitleNonResidential(title)) return null;

  // 2. Description headline non-residential check
  if (isDescriptionHeadlineNonResidential(description)) return null;

  // 3. Check if description reveals a different residential type
  const descType = getDescriptionHeadlineType(description);

  // 4. Standard classifier on title + URL slug
  const hint = `${title} ${urlSlug ?? ""}`;
  const titleType = classifyPropertyType(hint);

  // If title says one thing but description says another, trust description
  if (descType && titleType && descType !== titleType) {
    return descType;
  }

  return titleType;
}
