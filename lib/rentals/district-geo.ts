/**
 * Cambodia district GeoJSON normalization helpers.
 *
 * The actual GeoJSON boundary data lives in:
 *   public/geo/cambodia-districts.geojson
 *
 * This module maps scraped/stored district strings to the canonical names
 * used as feature properties.name in that GeoJSON.
 *
 * Phnom Penh inner-city sangkats (BKK1/2/3, Tonle Bassac, Toul Tom Poung)
 * are shown at sangkat level; everything else at khan / district (ADM2) level.
 */

/** Path to the static combined GeoJSON (fetched at runtime by the heatmap). */
export const CAMBODIA_GEOJSON_PATH = "/geo/cambodia-districts.geojson";

/* ── Normalisation ───────────────────────────────────────── */

const DISTRICT_NORMALIZE: Record<string, string> = {
  /* ── BKK / Chamkarmon sangkats ─────────────────────── */
  bkk1: "BKK1",
  "bkk 1": "BKK1",
  "boeung keng kang 1": "BKK1",
  "boeung keng kang i": "BKK1",
  "boeng keng kang": "BKK1",       // generic BKK → BKK1
  chamkarmon: "BKK1",              // khan containing BKK1/2/3 — default to BKK1
  "chamkar mon": "BKK1",
  bkk2: "BKK2",
  "bkk 2": "BKK2",
  bkk3: "BKK3",
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
  sensok: "Sen Sok",
  saensokh: "Sen Sok",
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
  meanchey: "Meanchey",
  "mean chey": "Meanchey",
  "boeung tumpun": "Meanchey",
  "boeung tumpun 1": "Meanchey",
  "phsar daeum thkov": "Meanchey",
  "chak angrae": "Meanchey",

  /* ── Chbar Ampov ───────────────────────────────────── */
  "chbar ampov": "Chbar Ampov",
  nirouth: "Chbar Ampov",

  /* ── Remaining PP outer khans ──────────────────────── */
  "por sen chey": "Por Sen Chey",
  "pur senchey": "Por Sen Chey",
  "por senchey": "Por Sen Chey",
  "stung meanchey": "Stung Meanchey",
  "stueng meanchey": "Stung Meanchey",
  dangkao: "Dangkao",
  kakap: "Dangkao",
  "prek pnov": "Prek Pnov",
  kamboul: "Kamboul",
  kambol: "Kamboul",

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
  sihanoukville: "Sihanoukville",
  "krong kaeb": "Kep",
  kep: "Kep",
  "kampong trach": "Kampong Trach",
  kampot: "Kampot",
  battambang: "Battambang",
  "krong akreiy ksatr": "Khsach Kandal",
};

/**
 * Normalise a district name to the canonical form used in the GeoJSON.
 * Returns the canonical name, or the original trimmed string if unknown.
 */
export function normalizeDistrictName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const key = cleaned
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Direct lookup
  if (DISTRICT_NORMALIZE[key]) return DISTRICT_NORMALIZE[key];

  // Substring match
  for (const [alias, canonical] of Object.entries(DISTRICT_NORMALIZE)) {
    if (key.includes(alias)) return canonical;
  }

  // Return cleaned original if no match
  return cleaned;
}
