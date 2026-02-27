/**
 * Phnom Penh district GeoJSON boundaries + normalization helpers.
 *
 * Simplified polygon boundaries for admin-facing choropleth map.
 * Inner-city sangkats (BKK1/2/3, Tonle Bassac, Toul Tom Poung) are
 * shown at sangkat level; outer areas are shown at khan level.
 */

import type { FeatureCollection, Feature, Polygon } from "geojson";

/* ── Normalisation ───────────────────────────────────────── */

const DISTRICT_NORMALIZE: Record<string, string> = {
  bkk1: "BKK1",
  "bkk 1": "BKK1",
  "boeung keng kang 1": "BKK1",
  "boeung keng kang i": "BKK1",
  bkk2: "BKK2",
  "bkk 2": "BKK2",
  bkk3: "BKK3",
  "bkk 3": "BKK3",
  "tonle bassac": "Tonle Bassac",
  "tonle basac": "Tonle Bassac",
  chamkarmon: "Chamkarmon",
  "chamkar mon": "Chamkarmon",
  "toul kork": "Toul Kork",
  "tuol kork": "Toul Kork",
  "toul tom poung": "Toul Tom Poung",
  "russian market": "Toul Tom Poung",
  "tuol tom pong": "Toul Tom Poung",
  "tuol tompong": "Toul Tom Poung",
  "daun penh": "Daun Penh",
  "doun penh": "Daun Penh",
  "7 makara": "7 Makara",
  "prampi makara": "7 Makara",
  "sen sok": "Sen Sok",
  "sensok": "Sen Sok",
  "chroy changvar": "Chroy Changvar",
  "chrouy changvar": "Chroy Changvar",
  meanchey: "Meanchey",
  "mean chey": "Meanchey",
  "chbar ampov": "Chbar Ampov",
  "por sen chey": "Por Sen Chey",
  "pur senchey": "Por Sen Chey",
  "russey keo": "Russey Keo",
  "russei keo": "Russey Keo",
  "stung meanchey": "Stung Meanchey",
  "stueng meanchey": "Stung Meanchey",
  dangkao: "Dangkao",
  "prek pnov": "Prek Pnov",
  kamboul: "Kamboul",
  kambol: "Kamboul",
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

/* ── GeoJSON boundaries ──────────────────────────────────── */

/**
 * Each polygon is a simplified rectangle/quad centred on the
 * approximate real district location. Adjacent districts share
 * boundary coordinates to tile cleanly.
 *
 * Coordinates are [longitude, latitude] per GeoJSON spec.
 */

function rect(
  left: number,
  bottom: number,
  right: number,
  top: number,
): [number, number][] {
  return [
    [left, bottom],
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
}

interface DistrictDef {
  name: string;
  coords: [number, number][];
}

const DISTRICTS: DistrictDef[] = [
  /* ── Inner-city sangkats (Chamkarmon area) ─────────── */
  { name: "BKK1", coords: rect(104.921, 11.553, 104.934, 11.562) },
  { name: "BKK2", coords: rect(104.921, 11.544, 104.934, 11.553) },
  { name: "BKK3", coords: rect(104.908, 11.544, 104.921, 11.562) },
  { name: "Tonle Bassac", coords: rect(104.934, 11.536, 104.948, 11.562) },
  { name: "Toul Tom Poung", coords: rect(104.908, 11.536, 104.934, 11.544) },

  /* ── Medium khans ──────────────────────────────────── */
  { name: "Daun Penh", coords: rect(104.908, 11.562, 104.948, 11.580) },
  { name: "7 Makara", coords: rect(104.893, 11.544, 104.908, 11.580) },
  { name: "Toul Kork", coords: rect(104.885, 11.580, 104.930, 11.598) },

  /* ── Outer khans ───────────────────────────────────── */
  { name: "Sen Sok", coords: rect(104.835, 11.575, 104.885, 11.622) },
  { name: "Russey Keo", coords: rect(104.893, 11.598, 104.935, 11.625) },
  { name: "Chroy Changvar", coords: rect(104.935, 11.580, 104.965, 11.640) },
  { name: "Por Sen Chey", coords: rect(104.833, 11.518, 104.870, 11.570) },
  { name: "Kamboul", coords: rect(104.795, 11.515, 104.833, 11.555) },
  { name: "Meanchey", coords: rect(104.900, 11.510, 104.940, 11.536) },
  { name: "Chbar Ampov", coords: rect(104.948, 11.505, 104.978, 11.550) },
  { name: "Stung Meanchey", coords: rect(104.890, 11.498, 104.920, 11.510) },
  { name: "Dangkao", coords: rect(104.855, 11.465, 104.900, 11.498) },
  { name: "Prek Pnov", coords: rect(104.860, 11.625, 104.920, 11.665) },
];

/** Pre-built FeatureCollection for Leaflet's L.geoJSON(). */
export const PHNOM_PENH_GEOJSON: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: DISTRICTS.map(
    (d): Feature<Polygon> => ({
      type: "Feature",
      properties: { name: d.name },
      geometry: {
        type: "Polygon",
        coordinates: [d.coords],
      },
    }),
  ),
};

/** Lookup: canonical district name → centre [lat, lng] for fallback. */
export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  BKK1: [11.5563, 104.9282],
  BKK2: [11.549, 104.924],
  BKK3: [11.5455, 104.917],
  "Tonle Bassac": [11.551, 104.935],
  "Toul Tom Poung": [11.544, 104.92],
  "Daun Penh": [11.572, 104.921],
  "7 Makara": [11.565, 104.91],
  "Toul Kork": [11.578, 104.902],
  "Sen Sok": [11.595, 104.87],
  "Russey Keo": [11.605, 104.91],
  "Chroy Changvar": [11.592, 104.94],
  "Por Sen Chey": [11.535, 104.85],
  Kamboul: [11.535, 104.82],
  Meanchey: [11.518, 104.918],
  "Chbar Ampov": [11.525, 104.95],
  "Stung Meanchey": [11.513, 104.91],
  Dangkao: [11.49, 104.88],
  "Prek Pnov": [11.64, 104.89],
};
