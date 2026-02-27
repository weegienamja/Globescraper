/**
 * Parsing helpers for rental listing data extraction.
 *
 * Deterministic parsers for price, beds/baths/size, district,
 * plus safe number coercion utilities.
 */

/* ── Safe coercion ───────────────────────────────────────── */

export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function safeInt(value: unknown): number | null {
  const n = safeNumber(value);
  if (n === null) return null;
  return Math.round(n);
}

/* ── Price parsing ───────────────────────────────────────── */

/**
 * Attempt to parse a price string into a monthly USD amount.
 *
 * Handles:
 *  - "$800", "$800/month", "USD 800 per month"
 *  - "800$/month"
 *  - Comma-separated thousands
 *
 * Rejects:
 *  - prices explicitly marked as nightly or weekly
 *  - prices below $50 or above $50,000 (likely errors)
 */
export function parsePriceMonthlyUsd(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const text = raw.toLowerCase().trim();

  // Reject nightly / weekly
  if (/\b(per\s*night|\/\s*night|nightly)\b/.test(text)) return null;
  if (/\b(per\s*week|\/\s*week|weekly)\b/.test(text)) return null;

  // Try to find a numeric value
  const cleaned = text.replace(/,/g, "");

  // Match patterns like "$1,200", "1200 USD", "USD 1200", "1200$/mo"
  const match = cleaned.match(
    /(?:\$|usd)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:\$|usd)/
  );

  if (!match) {
    // Try bare number if "month" or "mo" appears
    if (/\b(month|mo|\/mo)\b/.test(text)) {
      const bare = cleaned.match(/(\d+(?:\.\d+)?)/);
      if (bare) {
        const n = parseFloat(bare[1]);
        if (n >= 50 && n <= 50_000) return n;
      }
    }
    return null;
  }

  const amount = parseFloat(match[1] || match[2]);
  if (!Number.isFinite(amount)) return null;

  // Sanity bounds
  if (amount < 50 || amount > 50_000) return null;

  return amount;
}

/* ── Beds / Baths / Size ─────────────────────────────────── */

export interface BedsBathsSize {
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
}

/**
 * Extract bedrooms, bathrooms, and size from free text or structured HTML.
 */
export function parseBedsBathsSize(text: string): BedsBathsSize {
  const result: BedsBathsSize = { bedrooms: null, bathrooms: null, sizeSqm: null };
  if (!text) return result;

  const t = text.toLowerCase();

  // Bedrooms
  const bedMatch =
    t.match(/(\d+)\s*(?:bed(?:room)?s?|br)\b/) ||
    t.match(/(?:bed(?:room)?s?|br)\s*[:=]?\s*(\d+)/);
  if (bedMatch) result.bedrooms = safeInt(bedMatch[1]);

  // Bathrooms
  const bathMatch =
    t.match(/(\d+)\s*(?:bath(?:room)?s?|ba)\b/) ||
    t.match(/(?:bath(?:room)?s?|ba)\s*[:=]?\s*(\d+)/);
  if (bathMatch) result.bathrooms = safeInt(bathMatch[1]);

  // Size in sqm
  const sizeMatch =
    t.match(/(\d+(?:[.,]\d+)?)\s*(?:sq\.?\s*m|sqm|m²|m2)\b/) ||
    t.match(/(?:size|area|floor)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:sq\.?\s*m|sqm|m²|m2)?/);
  if (sizeMatch) {
    const val = parseFloat(sizeMatch[1].replace(",", "."));
    if (val > 0 && val < 10_000) result.sizeSqm = val;
  }

  return result;
}

/* ── District parsing ────────────────────────────────────── */

/** Known district aliases → canonical name */
const DISTRICT_ALIASES: Record<string, string> = {
  "bkk1": "BKK1",
  "bkk 1": "BKK1",
  "boeung keng kang 1": "BKK1",
  "boeung keng kang i": "BKK1",
  "bkk2": "BKK2",
  "bkk 2": "BKK2",
  "bkk3": "BKK3",
  "bkk 3": "BKK3",
  "tonle bassac": "Tonle Bassac",
  "tonle basac": "Tonle Bassac",
  "chamkarmon": "Chamkarmon",
  "chamkar mon": "Chamkarmon",
  "toul kork": "Toul Kork",
  "toul tom poung": "Toul Tom Poung",
  "russian market": "Toul Tom Poung",
  "tuol tom pong": "Toul Tom Poung",
  "daun penh": "Daun Penh",
  "7 makara": "7 Makara",
  "sen sok": "Sen Sok",
  "chroy changvar": "Chroy Changvar",
  "meanchey": "Meanchey",
  "mean chey": "Meanchey",
  "chbar ampov": "Chbar Ampov",
  "prampi makara": "7 Makara",
  "por sen chey": "Por Sen Chey",
  "russey keo": "Russey Keo",
  "stung meanchey": "Stung Meanchey",
};

/**
 * Attempt to parse a district from a location string.
 * If the text contains breadcrumb separators (">"), takes the last segment.
 */
export function parseDistrict(text: string | null | undefined): string | null {
  if (!text) return null;

  let cleaned = text.trim();

  // Handle breadcrumb-style strings like "Rent>Siem Reap>Siem Reap>Sala Kamraeuk"
  if (cleaned.includes(">")) {
    const segments = cleaned.split(">").map((s) => s.trim()).filter(Boolean);
    // Take the last segment (most specific location)
    cleaned = segments[segments.length - 1] || cleaned;
  }

  const lower = cleaned.toLowerCase().trim();

  // Check known aliases
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }

  // If the text is short enough (< 50 chars), return it as-is
  if (cleaned.length > 0 && cleaned.length < 50) {
    return cleaned;
  }

  return null;
}

/**
 * Extract city name from a breadcrumb or location string.
 * Look for known Cambodian cities; defaults to "Phnom Penh".
 */
const CITY_ALIASES: Record<string, string> = {
  "phnom penh": "Phnom Penh",
  "siem reap": "Siem Reap",
  "sihanoukville": "Sihanoukville",
  "kampot": "Kampot",
  "battambang": "Battambang",
  "kep": "Kep",
  "kompong cham": "Kompong Cham",
};

export function parseCity(text: string | null | undefined): string {
  if (!text) return "Phnom Penh";
  const lower = text.toLowerCase();
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  return "Phnom Penh";
}
