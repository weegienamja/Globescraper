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
 * approximate real district boundaries with irregular polygons.
 * Adjacent districts share boundary vertices to tile without gaps.
 *
 * Coordinates are [longitude, latitude] per GeoJSON spec.
 */

interface DistrictDef {
  name: string;
  coords: [number, number][];
}

/*
 * Shared boundary vertices referenced by multiple districts.
 * Named as compass bearings or landmark references.
 */

// ── River reference points (Tonle Sap / Mekong confluence) ──
const R_CONFLUENCE: [number, number] = [104.9325, 11.5680];
const R_TS_NORTH: [number, number] = [104.9340, 11.5820];
const R_TS_FAR_N: [number, number] = [104.9310, 11.5980];
const R_BASSAC_S: [number, number] = [104.9420, 11.5320];
const R_MEKONG_NE: [number, number] = [104.9520, 11.6400];

// ── Inner-city grid intersections ──
const X_MONIVONG_N: [number, number] = [104.9205, 11.5800];
const X_MONIVONG_CTR: [number, number] = [104.9200, 11.5625];
const X_MONIVONG_S: [number, number] = [104.9200, 11.5530];
const X_NORODOM_N: [number, number] = [104.9280, 11.5680];
const X_NORODOM_CTR: [number, number] = [104.9275, 11.5625];
const X_NORODOM_S: [number, number] = [104.9270, 11.5530];
const X_SIHANOUK_W: [number, number] = [104.9080, 11.5530];
const X_SIHANOUK_CTR: [number, number] = [104.9200, 11.5480];
const X_232_W: [number, number] = [104.9080, 11.5440];
const X_232_E: [number, number] = [104.9280, 11.5440];

const DISTRICTS: DistrictDef[] = [
  /* ── Inner-city sangkats ───────────────────────────── */
  {
    // BKK1 — bounded by Norodom, Sihanouk, Monivong, Mao Tse Tung
    name: "BKK1",
    coords: [
      [104.9200, 11.5530], [104.9210, 11.5585], [104.9215, 11.5625],
      [104.9280, 11.5625], [104.9275, 11.5580], [104.9270, 11.5530],
      [104.9240, 11.5525], [104.9200, 11.5530],
    ],
  },
  {
    // BKK2 — south of BKK1, between Monivong and Norodom
    name: "BKK2",
    coords: [
      [104.9200, 11.5440], [104.9200, 11.5480], [104.9200, 11.5530],
      [104.9240, 11.5525], [104.9270, 11.5530], [104.9280, 11.5440],
      [104.9240, 11.5435], [104.9200, 11.5440],
    ],
  },
  {
    // BKK3 — west of BKK1/BKK2, east of 7 Makara
    name: "BKK3",
    coords: [
      [104.9080, 11.5440], [104.9085, 11.5500], [104.9080, 11.5530],
      [104.9090, 11.5580], [104.9100, 11.5625], [104.9215, 11.5625],
      [104.9210, 11.5585], [104.9200, 11.5530], [104.9200, 11.5480],
      [104.9200, 11.5440], [104.9140, 11.5438], [104.9080, 11.5440],
    ],
  },
  {
    // Tonle Bassac — east of BKK1, along the Bassac river
    name: "Tonle Bassac",
    coords: [
      [104.9275, 11.5530], [104.9280, 11.5580], [104.9280, 11.5625],
      [104.9290, 11.5660], [104.9325, 11.5680], [104.9370, 11.5650],
      [104.9400, 11.5580], [104.9420, 11.5500], [104.9420, 11.5380],
      [104.9400, 11.5355], [104.9340, 11.5360], [104.9300, 11.5420],
      [104.9280, 11.5440], [104.9275, 11.5530],
    ],
  },
  {
    // Toul Tom Poung — south of BKK2/BKK3, "Russian Market"
    name: "Toul Tom Poung",
    coords: [
      [104.9080, 11.5360], [104.9075, 11.5400], [104.9080, 11.5440],
      [104.9140, 11.5438], [104.9200, 11.5440], [104.9240, 11.5435],
      [104.9280, 11.5440], [104.9300, 11.5420], [104.9340, 11.5360],
      [104.9280, 11.5340], [104.9200, 11.5350], [104.9140, 11.5355],
      [104.9080, 11.5360],
    ],
  },

  /* ── Central khans ─────────────────────────────────── */
  {
    // Daun Penh — historic centre, riverfront north
    name: "Daun Penh",
    coords: [
      [104.9100, 11.5625], [104.9100, 11.5680], [104.9095, 11.5720],
      [104.9100, 11.5780], [104.9120, 11.5800], [104.9205, 11.5800],
      [104.9260, 11.5790], [104.9310, 11.5770], [104.9340, 11.5820],
      [104.9380, 11.5780], [104.9370, 11.5720], [104.9370, 11.5650],
      [104.9325, 11.5680], [104.9290, 11.5660], [104.9280, 11.5625],
      [104.9215, 11.5625], [104.9100, 11.5625],
    ],
  },
  {
    // 7 Makara — west of Daun Penh, angular shape
    name: "7 Makara",
    coords: [
      [104.8920, 11.5500], [104.8910, 11.5560], [104.8900, 11.5620],
      [104.8895, 11.5700], [104.8900, 11.5780], [104.8950, 11.5800],
      [104.9000, 11.5810], [104.9100, 11.5800], [104.9100, 11.5780],
      [104.9095, 11.5720], [104.9100, 11.5680], [104.9100, 11.5625],
      [104.9090, 11.5580], [104.9080, 11.5530], [104.9085, 11.5500],
      [104.9080, 11.5440], [104.9020, 11.5445], [104.8960, 11.5460],
      [104.8920, 11.5500],
    ],
  },
  {
    // Toul Kork — north of centre, residential
    name: "Toul Kork",
    coords: [
      [104.8870, 11.5780], [104.8865, 11.5840], [104.8870, 11.5900],
      [104.8900, 11.5960], [104.8950, 11.5980], [104.9020, 11.5990],
      [104.9100, 11.5985], [104.9200, 11.5980], [104.9260, 11.5960],
      [104.9310, 11.5980], [104.9340, 11.5940], [104.9340, 11.5870],
      [104.9340, 11.5820], [104.9310, 11.5770], [104.9260, 11.5790],
      [104.9205, 11.5800], [104.9120, 11.5800], [104.9100, 11.5800],
      [104.9000, 11.5810], [104.8950, 11.5800], [104.8900, 11.5780],
      [104.8870, 11.5780],
    ],
  },

  /* ── Outer khans ───────────────────────────────────── */
  {
    // Sen Sok — large NW district
    name: "Sen Sok",
    coords: [
      [104.8380, 11.5760], [104.8350, 11.5880], [104.8360, 11.6000],
      [104.8400, 11.6100], [104.8450, 11.6180], [104.8540, 11.6220],
      [104.8660, 11.6200], [104.8780, 11.6100], [104.8850, 11.6020],
      [104.8870, 11.5960], [104.8900, 11.5960], [104.8870, 11.5900],
      [104.8865, 11.5840], [104.8870, 11.5780], [104.8680, 11.5760],
      [104.8530, 11.5750], [104.8380, 11.5760],
    ],
  },
  {
    // Russey Keo — northern district
    name: "Russey Keo",
    coords: [
      [104.8870, 11.5960], [104.8900, 11.5960], [104.8950, 11.5980],
      [104.9020, 11.5990], [104.9100, 11.5985], [104.9200, 11.5980],
      [104.9260, 11.5960], [104.9310, 11.5980], [104.9310, 11.6050],
      [104.9300, 11.6120], [104.9280, 11.6200], [104.9250, 11.6280],
      [104.9200, 11.6350], [104.9100, 11.6380], [104.9000, 11.6350],
      [104.8920, 11.6280], [104.8870, 11.6200], [104.8850, 11.6100],
      [104.8850, 11.6020], [104.8870, 11.5960],
    ],
  },
  {
    // Chroy Changvar — peninsula between Tonle Sap & Mekong
    name: "Chroy Changvar",
    coords: [
      [104.9340, 11.5820], [104.9340, 11.5870], [104.9340, 11.5940],
      [104.9350, 11.6020], [104.9380, 11.6100], [104.9420, 11.6200],
      [104.9480, 11.6320], [104.9530, 11.6400], [104.9580, 11.6380],
      [104.9620, 11.6300], [104.9600, 11.6200], [104.9560, 11.6100],
      [104.9520, 11.6000], [104.9480, 11.5900], [104.9440, 11.5820],
      [104.9400, 11.5790], [104.9380, 11.5780], [104.9340, 11.5820],
    ],
  },
  {
    // Por Sen Chey — southwest, large
    name: "Por Sen Chey",
    coords: [
      [104.8340, 11.5250], [104.8320, 11.5380], [104.8330, 11.5500],
      [104.8350, 11.5600], [104.8380, 11.5700], [104.8380, 11.5760],
      [104.8530, 11.5750], [104.8680, 11.5760], [104.8700, 11.5680],
      [104.8750, 11.5580], [104.8780, 11.5500], [104.8760, 11.5400],
      [104.8720, 11.5300], [104.8660, 11.5220], [104.8580, 11.5200],
      [104.8480, 11.5210], [104.8400, 11.5230], [104.8340, 11.5250],
    ],
  },
  {
    // Kamboul — far west
    name: "Kamboul",
    coords: [
      [104.7970, 11.5180], [104.7950, 11.5280], [104.7960, 11.5380],
      [104.8000, 11.5480], [104.8060, 11.5550], [104.8150, 11.5580],
      [104.8250, 11.5560], [104.8330, 11.5500], [104.8320, 11.5380],
      [104.8340, 11.5250], [104.8280, 11.5200], [104.8200, 11.5180],
      [104.8100, 11.5170], [104.7970, 11.5180],
    ],
  },
  {
    // Meanchey — south-central
    name: "Meanchey",
    coords: [
      [104.8960, 11.5120], [104.8940, 11.5200], [104.8920, 11.5300],
      [104.8920, 11.5400], [104.8920, 11.5500], [104.8960, 11.5460],
      [104.9020, 11.5445], [104.9080, 11.5440], [104.9075, 11.5400],
      [104.9080, 11.5360], [104.9140, 11.5355], [104.9200, 11.5350],
      [104.9280, 11.5340], [104.9340, 11.5360], [104.9380, 11.5300],
      [104.9400, 11.5200], [104.9380, 11.5120], [104.9300, 11.5080],
      [104.9200, 11.5060], [104.9100, 11.5080], [104.8960, 11.5120],
    ],
  },
  {
    // Chbar Ampov — east side, across Bassac river
    name: "Chbar Ampov",
    coords: [
      [104.9420, 11.5060], [104.9400, 11.5200], [104.9400, 11.5355],
      [104.9420, 11.5380], [104.9420, 11.5500], [104.9440, 11.5560],
      [104.9500, 11.5600], [104.9560, 11.5580], [104.9620, 11.5520],
      [104.9680, 11.5440], [104.9720, 11.5340], [104.9740, 11.5220],
      [104.9720, 11.5120], [104.9660, 11.5060], [104.9580, 11.5030],
      [104.9500, 11.5040], [104.9420, 11.5060],
    ],
  },
  {
    // Stung Meanchey — south, between Meanchey and Dangkao
    name: "Stung Meanchey",
    coords: [
      [104.8860, 11.4920], [104.8840, 11.5000], [104.8860, 11.5060],
      [104.8900, 11.5100], [104.8960, 11.5120], [104.9100, 11.5080],
      [104.9200, 11.5060], [104.9240, 11.4980], [104.9200, 11.4920],
      [104.9120, 11.4880], [104.9020, 11.4870], [104.8940, 11.4890],
      [104.8860, 11.4920],
    ],
  },
  {
    // Dangkao — far south
    name: "Dangkao",
    coords: [
      [104.8500, 11.4600], [104.8480, 11.4700], [104.8500, 11.4800],
      [104.8560, 11.4880], [104.8650, 11.4920], [104.8760, 11.4940],
      [104.8860, 11.4920], [104.8940, 11.4890], [104.9020, 11.4870],
      [104.9000, 11.4780], [104.8960, 11.4700], [104.8900, 11.4620],
      [104.8800, 11.4570], [104.8680, 11.4560], [104.8580, 11.4570],
      [104.8500, 11.4600],
    ],
  },
  {
    // Prek Pnov — far north
    name: "Prek Pnov",
    coords: [
      [104.8600, 11.6280], [104.8580, 11.6380], [104.8600, 11.6480],
      [104.8680, 11.6560], [104.8780, 11.6600], [104.8900, 11.6580],
      [104.9000, 11.6520], [104.9100, 11.6440], [104.9150, 11.6380],
      [104.9200, 11.6350], [104.9100, 11.6380], [104.9000, 11.6350],
      [104.8920, 11.6280], [104.8870, 11.6200], [104.8780, 11.6100],
      [104.8660, 11.6200], [104.8600, 11.6280],
    ],
  },
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
