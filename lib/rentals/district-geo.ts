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

/** Normalise stored district names to canonical GeoJSON feature names */
const DISTRICT_NORMALIZE: Record<string, string> = {
  /* ── Chamkar Mon sangkats ──────────────────────────── */
  "bkk1": "BKK1",
  "bkk 1": "BKK1",
  "boeung keng kang 1": "BKK1",
  "boeung keng kang i": "BKK1",
  "boeng keng kang": "BKK1",
  "bkk2": "BKK2",
  "bkk 2": "BKK2",
  "boeung keng kang 2": "BKK2",
  "bkk3": "BKK3",
  "bkk 3": "BKK3",
  "boeung keng kang 3": "BKK3",
  "tonle bassac": "Tonle Bassac",
  "tonle basac": "Tonle Bassac",
  "chakto mukh": "Chakto Mukh",
  "boeng trabaek": "Boeng Trabaek",
  "boeung trabek": "Boeng Trabaek",
  "toul tompong 1": "Toul Tompong 1",
  "tuol tumpong 1": "Toul Tompong 1",
  "toul tum poung 1": "Toul Tompong 1",
  "toul tum pong 1": "Toul Tompong 1",
  "toul tompong 2": "Toul Tompong 2",
  "tuol tumpong 2": "Toul Tompong 2",
  "toul tum poung 2": "Toul Tompong 2",
  "toul tum pong 2": "Toul Tompong 2",
  "russian market": "Toul Tompong 1",
  "olympic": "Olympic",
  "tumnob tuek": "Tumnob Tuek",
  "tuol svay prey 1": "Tuol Svay Prey 1",
  "tuol svay prey 2": "Tuol Svay Prey 2",
  // Generic Chamkar Mon / Toul Tom Poung → khan level
  "chamkarmon": "Chamkar Mon",
  "chamkar mon": "Chamkar Mon",
  "toul tom poung": "Chamkar Mon",
  "toul tum poung": "Chamkar Mon",
  "toul tum pong": "Chamkar Mon",
  "tuol tom pong": "Chamkar Mon",
  "tuol tompong": "Chamkar Mon",
  "tuol svay prey": "Chamkar Mon",

  /* ── Daun Penh sangkats ────────────────────────────── */
  "voat phnum": "Voat Phnum",
  "wat phnom": "Voat Phnum",
  "srah chak": "Srah Chak",
  "chey chumneah": "Chey Chumneah",
  "phsar chas": "Phsar Chas",
  "boeng reang": "Boeng Reang",
  "phsar kandal 1": "Phsar Kandal 1",
  "phsar kandal i": "Phsar Kandal 1",
  "phsar kandal 2": "Phsar Kandal 2",
  "phsar kandal ii": "Phsar Kandal 2",
  "phsar thmei 1": "Phsar Thmei 1",
  "phsar thmei i": "Phsar Thmei 1",
  "phsar thmey 1": "Phsar Thmei 1",
  "phsar thmei 2": "Phsar Thmei 2",
  "phsar thmei ii": "Phsar Thmei 2",
  "phsar thmey 2": "Phsar Thmei 2",
  "phsar thmei 3": "Phsar Thmei 3",
  "phsar thmei iii": "Phsar Thmei 3",
  "phsar thmey 3": "Phsar Thmei 3",
  // Generic Daun Penh / ambiguous sangkats → khan level
  "daun penh": "Daun Penh",
  "doun penh": "Daun Penh",
  "phsar kandal": "Daun Penh",
  "phsar thmey": "Daun Penh",
  "phsar thmei": "Daun Penh",

  /* ── 7 Makara sangkats ────────────────────────────── */
  "mittapheap": "Mittapheap",
  "monourom": "Monourom",
  "boeung prolit": "Boeng Proluet",
  "boeng proluet": "Boeng Proluet",
  "veal vong": "Veal Vong",
  "phsar daeum kor": "Phsar Daeum Kor",
  "boeng salang": "Boeng Salang",
  // Generic 7 Makara / ambiguous → khan level
  "7 makara": "7 Makara",
  "prampi makara": "7 Makara",
  "prampir meakkakra": "7 Makara",
  "phsar depou": "7 Makara",
  "ou ruessei": "7 Makara",

  /* ── Toul Kork sangkats ────────────────────────────── */
  "boeng kak 1": "Boeng Kak 1",
  "boeung kak 1": "Boeng Kak 1",
  "boeng kak 2": "Boeng Kak 2",
  "boeung kak 2": "Boeng Kak 2",
  "tuol sangke": "Tuol Sangke",
  "tuol sangkae": "Tuol Sangke",
  "tuek lak 1": "Tuek Lak 1",
  "tuek l'ak 1": "Tuek Lak 1",
  "tuek lak 2": "Tuek Lak 2",
  "tuek lak 3": "Tuek Lak 3",
  // Generic Toul Kork / ambiguous → khan level
  "toul kork": "Toul Kork",
  "tuol kork": "Toul Kork",
  "tuol kouk": "Toul Kork",
  "boeung kak": "Toul Kork",
  "tuek l'ak": "Toul Kork",
  "teuk laak": "Toul Kork",

  /* ── Sen Sok sangkats ──────────────────────────────── */
  "phnom penh thmey": "Phnom Penh Thmei",
  "phnom penh thmei": "Phnom Penh Thmei",
  "tuek thla": "Tuek Thla",
  "khmuonh": "Khmuonh",
  "krang thnong": "Krang Thnong",
  // Generic Sen Sok → khan level
  "sen sok": "Sen Sok",
  "sensok": "Sen Sok",
  "saensokh": "Sen Sok",

  /* ── Russey Keo sangkats ───────────────────────────── */
  "ruessei kaev": "Ruessei Kaev",
  "svay pak": "Svay Pak",
  "preaek ta sek": "Preaek Ta Sek",
  "preaek lieb": "Preaek Lieb",
  // Generic Russey Keo → khan level
  "russey keo": "Russey Keo",
  "russei keo": "Russey Keo",

  /* ── Chroy Changvar sangkats ───────────────────────── */
  "chrouy changvar": "Chrouy Changvar",
  "kaoh dach": "Kaoh Dach",
  "preaek ampil": "Preaek Ampil",
  // Generic Chroy Changvar → khan level
  "chroy changvar": "Chroy Changvar",
  "chrouy changva": "Chroy Changvar",

  /* ── Meanchey sangkats ─────────────────────────────── */
  "boeng tumpun": "Boeng Tumpun",
  "boeung tumpun": "Boeng Tumpun",
  "boeung tumpun 1": "Boeng Tumpun",
  "phsar daeum thkov": "Phsar Daeum Thkov",
  "chak angrae leu": "Chak Angrae Leu",
  "chak angrae kraom": "Chak Angrae Kraom",
  // Generic Meanchey → khan level (GeoJSON parent district = "Meanchey")
  "meanchey": "Meanchey",
  "mean chey": "Meanchey",
  "chak angrae": "Meanchey",

  /* ── Chbar Ampov sangkats ──────────────────────────── */
  "nirouth": "Nirouth",
  "preaek pra": "Preaek Pra",
  "veal sbov": "Veal Sbov",
  "preaek aeng": "Preaek Aeng",
  // Generic Chbar Ampov → khan level
  "chbar ampov": "Chbar Ampov",

  /* ── Other PP khan sangkats ────────────────────────── */
  "chaom chau": "Chaom Chau",
  "kakab": "Kakab",
  "kakap": "Kakab",
  "stueng meanchey": "Stueng Meanchey",
  "stueng mean chey": "Stueng Meanchey",
  "stung mean chey": "Stueng Meanchey",
  "preaek phnov": "Preaek Phnov",
  "prey sa": "Prey Sa",
  "spean thma": "Spean Thma",
  // Generic outer khans → khan level
  "por sen chey": "Por Sen Chey",
  "pur senchey": "Por Sen Chey",
  "por senchey": "Por Sen Chey",
  "stung meanchey": "Stung Meanchey",
  "dangkao": "Dangkao",
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
 * Given a canonical (normalised) district name, return all raw alias strings
 * from the normalisation map that resolve to it, PLUS the canonical name itself.
 * Useful for querying the DB where district values may be stored un-normalised.
 *
 * Example: reverseDistrictAliases("Chamkar Mon")
 *   → ["Chamkar Mon", "chamkarmon", "chamkar mon", "toul tom poung", "toul tum poung", …]
 */
export function reverseDistrictAliases(canonical: string): string[] {
  const result = new Set<string>();
  result.add(canonical); // always include the canonical name itself

  for (const [alias, target] of Object.entries(DISTRICT_NORMALIZE)) {
    if (target === canonical) {
      result.add(alias);
      // Also add Title Case / original-looking forms
      const titleCase = alias
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      result.add(titleCase);
    }
  }

  return Array.from(result);
}

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
