/**
 * Build a hybrid Cambodia GeoJSON:
 * - ADM2 (district) for all of Cambodia EXCEPT Phnom Penh khans and Siem Reap
 * - ADM3 sangkat polygons merged into display-name groups for Phnom Penh
 * - ADM3 sangkat polygons for the Siem Reap district area
 *
 * Boundary data: geoBoundaries.org (CC BY 4.0)
 *
 * Run once: npx tsx scripts/build-cambodia-geojson.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const ADM2_PATH = join(ROOT, "data/cambodia-adm2-simplified.geojson");
const ADM3_PATH = join(ROOT, "data/cambodia-adm3-simplified.geojson");
const OUT_PATH = join(ROOT, "public/geo/cambodia-districts.geojson");

/* ── ADM2 features to EXCLUDE ──────────────────────────── */

/** PP ADM2 khans (replaced by merged ADM3 sangkats) */
const PP_KHANS_EXCLUDE = new Set([
  "Chamkar Mon",
  "Tuol Kouk",
  "Doun Penh",
  "Prampir Meakkakra",
  "Saensokh",
  "Mean Chey",
  "Chraoy Chongvar",
  "Chbar Ampov",
  "Pur SenChey",
  "Russey Keo",
  "Dangkao",
  "Praek Pnov",
]);

/** SR ADM2 (replaced by ADM3 sangkats) */
const SR_ADM2_EXCLUDE = new Set(["Siem Reap"]);

/* ── ADM2 rename ───────────────────────────────────────── */

const ADM2_RENAME: Record<string, string> = {
  Kaeb: "Kep",
  "Khemara Phoumin": "Sihanoukville",
};

/* ── Phnom Penh ADM3 → display name mapping ────────────── */

/**
 * Maps ADM3 shapeName → our display name.
 * Multiple sangkats sharing a display name are merged into one MultiPolygon.
 */
const PP_ADM3_MAP: Record<string, string> = {
  /* ── Chamkar Mon → BKK1/2/3, Tonle Bassac, Toul Tom Poung ── */
  // BKK1/2/3 are mapped by shapeID below (names truncated in source)
  "Tonle Basak": "Tonle Bassac",
  "Chakto Mukh": "Tonle Bassac",
  "Boeng Trabaek": "Toul Tom Poung",
  "Tuol Tumpung Ti Muoy": "Toul Tom Poung",
  "Tuol Tumpung Ti Pir": "Toul Tom Poung",
  Olympic: "Toul Tom Poung",
  "Tumnob Tuek": "Toul Tom Poung",

  /* ── Daun Penh ── */
  "Voat Phnum": "Daun Penh",
  "Phsar Kandal Ti Muoy": "Daun Penh",
  "Phsar Kandal Ti Pir": "Daun Penh",
  "Srah Chak": "Daun Penh",
  "Chey Chummeah": "Daun Penh",
  "Phsar Thmei Ti Muoy": "Daun Penh",
  "Phsar Thmei Ti Pir": "Daun Penh",
  "Phsar Thmei Ti Bei": "Daun Penh",
  "Phsar Chas": "Daun Penh",
  "Boeng Reang": "Daun Penh",

  /* ── 7 Makara ── */
  Mittapheap: "7 Makara",
  Monourom: "7 Makara",
  "Boeng Proluet": "7 Makara",
  "Veal Vong": "7 Makara",
  "Ou Ruessei Ti Muoy": "7 Makara",
  "Ou Ruessei Ti Pir": "7 Makara",
  "Ou Ruessei Ti Bei": "7 Makara",
  "Ou Ruessei Ti Buon": "7 Makara",
  "Phsar Depou Ti Muoy": "7 Makara",
  "Phsar Depou Ti Pir": "7 Makara",
  "Phsar Depou Ti Bei": "7 Makara",
  "Phsar Daeum Kor": "7 Makara",
  "Boeng Salang": "7 Makara",

  /* ── Toul Kork ── */
  "Boeng Kak Ti Muoy": "Toul Kork",
  "Boeng Kak Ti Pir": "Toul Kork",
  "Tuol Sangke": "Toul Kork",

  /* ── Sen Sok ── */
  "Phnom Penh Thmei": "Sen Sok",
  "Tuek Thla": "Sen Sok",
  Khmuonh: "Sen Sok",
  "Krang Thnong": "Sen Sok",

  /* ── Russey Keo ── */
  "Ruessei Kaev": "Russey Keo",
  "Svay Pak": "Russey Keo",
  "Preaek Ta Sek": "Russey Keo",
  "Preaek Lieb": "Russey Keo",

  /* ── Chroy Changvar ── */
  "Chrouy Changvar": "Chroy Changvar",
  "Kaoh Dach": "Chroy Changvar",
  "Preaek Ampil": "Chroy Changvar",
  "Svay Chrum": "Chroy Changvar",

  /* ── Meanchey ── */
  "Boeng Tumpun": "Meanchey",
  "Phsar Daeum Thkov": "Meanchey",
  "Chak Angrae Leu": "Meanchey",
  "Chak Angrae Kraom": "Meanchey",

  /* ── Stung Meanchey ── */
  "Stueng Mean chey": "Stung Meanchey",

  /* ── Chbar Ampov ── */
  "Chhbar Ampov Ti Muoy": "Chbar Ampov",
  "Chbar Ampov Ti Pir": "Chbar Ampov",
  Nirouth: "Chbar Ampov",
  "Preaek Pra": "Chbar Ampov",
  "Veal Sbov": "Chbar Ampov",
  "Preaek Aeng": "Chbar Ampov",

  /* ── Por Sen Chey ── */
  "Chaom Chau": "Por Sen Chey",
  Kakab: "Por Sen Chey",

  /* ── Kamboul ── */
  "Pong Tuek": "Kamboul",
  "Prey Veaeng": "Kamboul",
  "Sak Sampov": "Kamboul",

  /* ── Dangkao ── */
  Dangkao: "Dangkao",
  "Prey Sa": "Dangkao",
  "Spean Thma": "Dangkao",
  "Cheung Aek": "Dangkao",
  "Preaek Kampues": "Dangkao",
  "Prek Ruessey": "Dangkao",

  /* ── Prek Pnov ── */
  "Preaek Phnov": "Prek Pnov",
  "Kaoh Oknha Tei": "Prek Pnov",
};

/**
 * BKK features have identical truncated names in geoBoundaries.
 * Disambiguate by full shapeID → display name.
 */
const BKK_BY_ID: Record<string, string> = {
  "89927896B73048198705496": "BKK1",
  "89927896B68782742352730": "BKK2",
  "89927896B61351852717763": "BKK3",
};

/**
 * Truncated ADM3 shapeNames — match by prefix.
 */
const PP_TRUNCATED_MAP: Record<string, string> = {
  "Tuek L'ak Ti": "Toul Kork",
  "Tuol Svay Prey Ti": "Toul Tom Poung",
  "Chrang Chamreh Ti": "Russey Keo",
  "Kilomaetr Lekh Pram": "Russey Keo",
  "Preaek Ta kov": "Chroy Changvar",
};

/* ── Siem Reap ADM3 config ─────────────────────────────── */

const SR_SANGKATS = new Set([
  "Sala Kamreuk",
  "Svay Dankum",
  "Sla Kram",
  "Kok Chak",
  "Siem Reab",
  "Srangae",
  "Nokor Thum",
  "Khnat",
  "Tuek Vil",
  "Chreav",
  "Krabei Riel",
  "Sngkat Sambuor",
  "Chong Khnies",
  "Ampil",
  "Kandaek",
  "Roluos",
  "Kampong Phluk",
  "Leang Dai",
  "Doun Kaev",
  "Preah Dak",
  "Kaev Poar",
  "Bakong",
]);

const SR_BBOX = {
  minLat: 13.2,
  maxLat: 13.52,
  minLng: 103.69,
  maxLng: 104.02,
};

const SR_RENAME: Record<string, string> = {
  "Siem Reab": "Siem Reap",
  "Sngkat Sambuor": "Sambuor",
};

/* ── Helpers ────────────────────────────────────────────── */

function featureCentroid(feature: any): [number, number] {
  const geom = feature.geometry;
  const ring =
    geom.type === "MultiPolygon"
      ? geom.coordinates[0][0]
      : geom.coordinates[0];
  const n = ring.length;
  let latS = 0,
    lngS = 0;
  for (let i = 0; i < n; i++) {
    lngS += ring[i][0];
    latS += ring[i][1];
  }
  return [latS / n, lngS / n];
}

/**
 * Extract all polygon rings from a feature as MultiPolygon coordinate arrays.
 * Normalises both Polygon and MultiPolygon to uniform [ring[]] arrays.
 */
function extractPolygons(feature: any): number[][][][] {
  const geom = feature.geometry;
  if (geom.type === "MultiPolygon") {
    return geom.coordinates;
  }
  return [geom.coordinates];
}

/**
 * Merge multiple features into a single MultiPolygon GeoJSON feature.
 */
function mergeFeatures(
  features: any[],
  properties: Record<string, any>,
): any {
  const allPolygons: number[][][][] = [];
  for (const f of features) {
    allPolygons.push(...extractPolygons(f));
  }
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "MultiPolygon",
      coordinates: allPolygons,
    },
  };
}

/* ── PP bounding box — reject ADM3 features outside PP ── */

const PP_BBOX = {
  minLat: 11.43,
  maxLat: 11.70,
  minLng: 104.78,
  maxLng: 105.02,
};

/* ── Resolve PP ADM3 feature → display name ────────────── */

function resolvePPName(feature: any): string | null {
  const shapeName: string = feature.properties.shapeName;
  const shapeID: string = feature.properties.shapeID;

  // 1. BKK by shapeID (unique, no bbox needed)
  if (BKK_BY_ID[shapeID]) return BKK_BY_ID[shapeID];

  // 2. Geographic filter — reject features outside PP
  const [lat, lng] = featureCentroid(feature);
  if (
    lat < PP_BBOX.minLat ||
    lat > PP_BBOX.maxLat ||
    lng < PP_BBOX.minLng ||
    lng > PP_BBOX.maxLng
  )
    return null;

  // 3. Direct name match
  if (PP_ADM3_MAP[shapeName]) return PP_ADM3_MAP[shapeName];

  // 4. Truncated name (prefix match)
  for (const [prefix, displayName] of Object.entries(PP_TRUNCATED_MAP)) {
    if (shapeName.startsWith(prefix)) return displayName;
  }

  return null;
}

/* ── Build ─────────────────────────────────────────────── */

function main() {
  console.log("Reading source data...");
  const adm2 = JSON.parse(readFileSync(ADM2_PATH, "utf-8"));
  const adm3 = JSON.parse(readFileSync(ADM3_PATH, "utf-8"));
  console.log(`  ADM2 features: ${adm2.features.length}`);
  console.log(`  ADM3 features: ${adm3.features.length}`);

  /* ── 1. ADM2 baseline (minus PP + SR) ── */

  const baseFeatures = adm2.features
    .filter(
      (f: any) =>
        !PP_KHANS_EXCLUDE.has(f.properties.shapeName) &&
        !SR_ADM2_EXCLUDE.has(f.properties.shapeName),
    )
    .map((f: any) => {
      const rawName = f.properties.shapeName;
      const name = ADM2_RENAME[rawName] || rawName;
      return { type: "Feature", properties: { name }, geometry: f.geometry };
    });
  console.log(
    `\n  ADM2 baseline: ${baseFeatures.length} (excl ${adm2.features.length - baseFeatures.length} PP/SR)`,
  );

  /* ── 2. Phnom Penh — individual ADM3 sangkats (named by parent district) ── */

  const ppFeatures: any[] = [];
  const ppCounts = new Map<string, number>();

  for (const f of adm3.features) {
    const displayName = resolvePPName(f);
    if (!displayName) continue;
    ppCounts.set(displayName, (ppCounts.get(displayName) || 0) + 1);
    ppFeatures.push({
      type: "Feature",
      properties: { name: displayName, zone: "phnom-penh" },
      geometry: f.geometry,
    });
  }

  const ppDistricts = new Set(ppCounts.keys());
  console.log(
    `  PP sangkats: ${ppFeatures.length} ADM3 features across ${ppDistricts.size} districts`,
  );
  for (const [name, count] of [...ppCounts.entries()].sort()) {
    console.log(`    ${name.padEnd(20)} ← ${count} sangkat(s)`);
  }

  /* ── 3. Siem Reap — individual ADM3 sangkats ── */

  const srFeatures = adm3.features
    .filter((f: any) => {
      if (!SR_SANGKATS.has(f.properties.shapeName)) return false;
      const [lat, lng] = featureCentroid(f);
      return (
        lat >= SR_BBOX.minLat &&
        lat <= SR_BBOX.maxLat &&
        lng >= SR_BBOX.minLng &&
        lng <= SR_BBOX.maxLng
      );
    })
    .map((f: any) => {
      const rawName = f.properties.shapeName;
      const name = SR_RENAME[rawName] || rawName;
      return {
        type: "Feature",
        properties: { name, zone: "siem-reap" },
        geometry: f.geometry,
      };
    });
  console.log(`  SR sangkats: ${srFeatures.length}`);

  /* ── 4. Combine and write ── */

  const combined = {
    type: "FeatureCollection",
    features: [...baseFeatures, ...ppFeatures, ...srFeatures],
  };

  console.log(`\n  Total features: ${combined.features.length}`);
  console.log(
    `    ADM2 base: ${baseFeatures.length}, PP: ${ppFeatures.length}, SR: ${srFeatures.length}`,
  );

  mkdirSync(join(ROOT, "public/geo"), { recursive: true });
  const json = JSON.stringify(combined);
  writeFileSync(OUT_PATH, json);
  console.log(`  Wrote ${(json.length / 1024).toFixed(1)} KB → ${OUT_PATH}`);
}

main();
