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
 *  - prices with "sale" context but no "rent" context (likely sale prices)
 *  - prices below $50 or above $15,000 (likely errors or sale prices)
 */
export function parsePriceMonthlyUsd(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const text = raw.toLowerCase().trim();

  // Reject nightly / weekly
  if (/\b(per\s*night|\/\s*night|nightly)\b/.test(text)) return null;
  if (/\b(per\s*week|\/\s*week|weekly)\b/.test(text)) return null;

  // Reject sale-context prices (unless also mentions rent)
  if (/\b(for\s*sale|sale\s*price)\b/.test(text) && !/\b(for\s*rent|per\s*month|\/\s*month)\b/.test(text))
    return null;

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
        if (n >= 50 && n <= 15_000) return n;
      }
    }
    return null;
  }

  const amount = parseFloat(match[1] || match[2]);
  if (!Number.isFinite(amount)) return null;

  // Sanity bounds (max $15k/mo — highest realistic monthly rent)
  if (amount < 50 || amount > 15_000) return null;

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

/** Known district aliases → canonical name (must match GeoJSON polygon names) */
const DISTRICT_ALIASES: Record<string, string> = {
  /* ── BKK / Chamkarmon sangkats ─────────────────────── */
  "bkk1": "BKK1",
  "bkk 1": "BKK1",
  "boeung keng kang 1": "BKK1",
  "boeung keng kang i": "BKK1",
  "boeng keng kang": "BKK1",
  "chamkarmon": "BKK1",
  "chamkar mon": "BKK1",
  "bkk2": "BKK2",
  "bkk 2": "BKK2",
  "bkk3": "BKK3",
  "bkk 3": "BKK3",
  "tonle bassac": "Tonle Bassac",
  "tonle basac": "Tonle Bassac",
  "toul tom poung": "Toul Tom Poung",
  "toul tum poung": "Toul Tom Poung",
  "toul tum pong": "Toul Tom Poung",
  "russian market": "Toul Tom Poung",
  "tuol tom pong": "Toul Tom Poung",
  "tuol tompong": "Toul Tom Poung",
  "boeung trabek": "Toul Tom Poung",

  /* ── Daun Penh sangkats ────────────────────────────── */
  "daun penh": "Daun Penh",
  "doun penh": "Daun Penh",
  "wat phnom": "Daun Penh",
  "phsar kandal": "Daun Penh",
  "srah chak": "Daun Penh",
  "chakto mukh": "Daun Penh",
  "boeng reang": "Daun Penh",
  "chey chumneah": "Daun Penh",
  "phsar thmey": "Daun Penh",

  /* ── 7 Makara sangkats ────────────────────────────── */
  "7 makara": "7 Makara",
  "prampi makara": "7 Makara",
  "prampir meakkakra": "7 Makara",
  "boeung prolit": "7 Makara",
  "veal vong": "7 Makara",
  "phsar depou": "7 Makara",
  "tuol svay prey": "7 Makara",
  "tuol sangkae": "7 Makara",

  /* ── Toul Kork sangkats ────────────────────────────── */
  "toul kork": "Toul Kork",
  "tuol kork": "Toul Kork",
  "tuol kouk": "Toul Kork",
  "boeung kak 1": "Toul Kork",
  "boeung kak 2": "Toul Kork",
  "boeung kak": "Toul Kork",
  "tuek l'ak": "Toul Kork",
  "tuek l'ak 1": "Toul Kork",
  "teuk laak": "Toul Kork",

  /* ── Sen Sok sangkats ──────────────────────────────── */
  "sen sok": "Sen Sok",
  "sensok": "Sen Sok",
  "saensokh": "Sen Sok",
  "phnom penh thmey": "Sen Sok",
  "tuek thla": "Sen Sok",

  /* ── Russey Keo ────────────────────────────────────── */
  "russey keo": "Russey Keo",
  "russei keo": "Russey Keo",
  "ruessei kaev": "Russey Keo",

  /* ── Chroy Changvar ────────────────────────────────── */
  "chroy changvar": "Chroy Changvar",
  "chrouy changvar": "Chroy Changvar",
  "chrouy changva": "Chroy Changvar",

  /* ── Meanchey sangkats ─────────────────────────────── */
  "meanchey": "Meanchey",
  "mean chey": "Meanchey",
  "boeung tumpun": "Meanchey",
  "boeung tumpun 1": "Meanchey",
  "phsar daeum thkov": "Meanchey",
  "chak angrae": "Meanchey",

  /* ── Chbar Ampov ───────────────────────────────────── */
  "chbar ampov": "Chbar Ampov",
  "nirouth": "Chbar Ampov",

  /* ── Remaining outer khans ─────────────────────────── */
  "por sen chey": "Por Sen Chey",
  "pur senchey": "Por Sen Chey",
  "por senchey": "Por Sen Chey",
  "stung meanchey": "Stung Meanchey",
  "stueng meanchey": "Stung Meanchey",
  "dangkao": "Dangkao",
  "kakap": "Dangkao",
  "prek pnov": "Prek Pnov",
  "kamboul": "Kamboul",
  "kambol": "Kamboul",

  /* ── Siem Reap sangkats (individual ADM3 zones) ────── */
  "siem reap": "Siem Reap",
  "krong siem reab": "Siem Reap",
  "siem reab": "Siem Reap",
  "sala kamraeuk": "Sala Kamreuk",
  "sala kamreuk": "Sala Kamreuk",
  "svay dankum": "Svay Dankum",
  "sla kram": "Sla Kram",
  "kouk chak": "Kok Chak",
  "kok chak": "Kok Chak",
  "chreav": "Chreav",
  "srangae": "Srangae",
  "nokor thum": "Nokor Thum",
  "krabei riel": "Krabei Riel",
  "khnat": "Khnat",
  "tuek vil": "Tuek Vil",
  "chong khnies": "Chong Khnies",
  "sambuor": "Sambuor",
  "sngkat sambuor": "Sambuor",
  "bakong": "Bakong",
  "prasat bakong": "Bakong",
  "roluos": "Roluos",
  "kampong phluk": "Kampong Phluk",
  "ampil": "Ampil",
  "kandaek": "Kandaek",
  "leang dai": "Leang Dai",
  "doun kaev": "Doun Kaev",
  "preah dak": "Preah Dak",
  "kaev poar": "Kaev Poar",

  /* ── Other province / city mappings ────────────────── */
  "krong preah sihanouk": "Sihanoukville",
  "sihanoukville": "Sihanoukville",
  "krong kaeb": "Kep",
  "kep": "Kep",
  "kampong trach": "Kampong Trach",
  "kampot": "Kampot",
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

/* ── Amenities extraction ────────────────────────────────── */

/**
 * Known amenity keywords / phrases to look for in listing descriptions.
 * Each entry is [regex pattern, canonical display label].
 * Patterns are matched case-insensitively against the full text.
 */
const AMENITY_PATTERNS: [RegExp, string][] = [
  // Pool & fitness
  [/\bswimming\s*pool\b/i, "Swimming Pool"],
  [/\bpool\b(?!.*table)/i, "Swimming Pool"],
  [/\bgym\b/i, "Gym"],
  [/\bfitness\b/i, "Fitness Center"],
  [/\bsauna\b/i, "Sauna"],
  [/\bsteam\b/i, "Steam Room"],
  [/\byoga\b/i, "Yoga Room"],

  // Parking
  [/\bcar\s*park/i, "Car Parking"],
  [/\bparking\b/i, "Parking"],
  [/\bmotorcycle\s*park/i, "Motorcycle Parking"],

  // Outdoor / common
  [/\bbalcon/i, "Balcony"],
  [/\brooftop\b/i, "Rooftop"],
  [/\bterrace\b/i, "Terrace"],
  [/\bgarden\b/i, "Garden"],
  [/\bplayground\b/i, "Playground"],
  [/\bbbq\b|barbecue/i, "BBQ Area"],

  // Building amenities
  [/\belevator\b|\blift\b/i, "Elevator"],
  [/\bsecurity\b|\b24\s*(?:hr|hour).*(?:security|guard)/i, "24h Security"],
  [/\bcctv\b/i, "CCTV"],
  [/\breception\b|\blob+y\b/i, "Reception/Lobby"],
  [/\bco[\- ]?working\b/i, "Co-working Space"],
  [/\bmeeting\s*room\b|conference\s*room/i, "Meeting Room"],
  [/\blounge\b/i, "Lounge"],
  [/\bsky\s*(?:bar|lounge|deck)\b/i, "Sky Bar/Lounge"],

  // In-unit
  [/\bfull(?:y)?\s*furnish/i, "Fully Furnished"],
  [/\bsemi[\- ]?furnish/i, "Semi-Furnished"],
  [/\bunfurnish/i, "Unfurnished"],
  [/\bwash(?:ing)?\s*machine/i, "Washing Machine"],
  [/\bair[\- ]?con/i, "Air Conditioning"],
  [/\ba\/?c\b/i, "Air Conditioning"],
  [/\bhot\s*water\b/i, "Hot Water"],
  [/\bbathtub\b/i, "Bathtub"],
  [/\bwifi\b|\bwi[\- ]?fi\b|\binternet\b/i, "WiFi/Internet"],
  [/\bcable\s*tv\b/i, "Cable TV"],
  [/\bkitchen\b/i, "Kitchen"],
  [/\bmicrowave\b/i, "Microwave"],
  [/\brefrigerator\b|\bfridge\b/i, "Refrigerator"],
  [/\boven\b/i, "Oven"],

  // Utilities info (useful context for renters)
  [/\belectric(?:ity)?\s*\$?\s*[\d.]+\s*\/?\s*(?:unit|kwh)/i, "Electricity Metered"],
  [/\bwater\s*\$?\s*[\d.]+\s*\/?\s*(?:unit|m3|cubic)/i, "Water Metered"],

  // Services
  [/\bcleaning\s*service/i, "Cleaning Service"],
  [/\blaundry\b/i, "Laundry"],
  [/\bconcierge\b/i, "Concierge"],
];

/**
 * Extract amenities from description text.
 *
 * Returns a deduplicated list of canonical amenity labels found in the text.
 * Handles free-form descriptions with bullet points, dashes, or plain prose.
 */
export function parseAmenities(text: string | null | undefined): string[] {
  if (!text) return [];

  const found = new Set<string>();

  for (const [pattern, label] of AMENITY_PATTERNS) {
    if (pattern.test(text)) {
      found.add(label);
    }
  }

  // If we found both "Swimming Pool" (from generic /pool/) and "Parking",
  // make sure we don't double-count sub-patterns
  // "Swimming Pool" takes precedence over the generic "Pool" match — already handled
  // since they map to the same label.

  return [...found].sort();
}
