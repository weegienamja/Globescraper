/**
 * Build a hybrid Cambodia GeoJSON:
 * - ADM2 (district) for all of Cambodia EXCEPT Phnom Penh khans and Siem Reap
 * - ADM3 individual sangkat polygons for Phnom Penh (each with unique name + parent district)
 * - ADM3 individual sangkat polygons for the Siem Reap district area
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

/** PP ADM2 khans (replaced by individual ADM3 sangkats) */
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

/* ── Phnom Penh ADM3 → individual sangkat mapping ──────── */

/** Info about an individual PP sangkat. */
interface SangkatInfo {
  /** Unique sangkat display name (used as GeoJSON feature name). */
  name: string;
  /** Parent khan / district. */
  district: string;
}

/**
 * Maps ADM3 shapeName → individual sangkat info.
 * Each sangkat becomes its own GeoJSON feature with a unique name.
 * Truncated shapeNames (ending with *) are matched exactly as they appear.
 */
const PP_ADM3_MAP: Record<string, SangkatInfo> = {
  /* ── Chamkar Mon sangkats ────────────────────────────── */
  // BKK1/2/3 mapped by shapeID below (truncated names in source)
  "Tonle Basak": { name: "Tonle Bassac", district: "Chamkar Mon" },
  "Chakto Mukh": { name: "Chakto Mukh", district: "Chamkar Mon" },
  "Boeng Trabaek": { name: "Boeng Trabaek", district: "Chamkar Mon" },
  "Tuol Tumpung Ti Muoy": { name: "Toul Tompong 1", district: "Chamkar Mon" },
  "Tuol Tumpung Ti Pir": { name: "Toul Tompong 2", district: "Chamkar Mon" },
  Olympic: { name: "Olympic", district: "Chamkar Mon" },
  "Tumnob Tuek": { name: "Tumnob Tuek", district: "Chamkar Mon" },
  // Tuol Svay Prey — truncated in source data
  "Tuol Svay Prey Ti M*": { name: "Tuol Svay Prey 1", district: "Chamkar Mon" },
  "Tuol Svay Prey Ti P*": { name: "Tuol Svay Prey 2", district: "Chamkar Mon" },

  /* ── Daun Penh sangkats ──────────────────────────────── */
  "Voat Phnum": { name: "Voat Phnum", district: "Daun Penh" },
  "Phsar Kandal Ti Muoy": { name: "Phsar Kandal 1", district: "Daun Penh" },
  "Phsar Kandal Ti Pir": { name: "Phsar Kandal 2", district: "Daun Penh" },
  "Srah Chak": { name: "Srah Chak", district: "Daun Penh" },
  "Chey Chummeah": { name: "Chey Chumneah", district: "Daun Penh" },
  "Phsar Thmei Ti Muoy": { name: "Phsar Thmei 1", district: "Daun Penh" },
  "Phsar Thmei Ti Pir": { name: "Phsar Thmei 2", district: "Daun Penh" },
  "Phsar Thmei Ti Bei": { name: "Phsar Thmei 3", district: "Daun Penh" },
  "Phsar Chas": { name: "Phsar Chas", district: "Daun Penh" },
  "Boeng Reang": { name: "Boeng Reang", district: "Daun Penh" },

  /* ── 7 Makara sangkats ───────────────────────────────── */
  Mittapheap: { name: "Mittapheap", district: "7 Makara" },
  Monourom: { name: "Monourom", district: "7 Makara" },
  "Boeng Proluet": { name: "Boeng Proluet", district: "7 Makara" },
  "Veal Vong": { name: "Veal Vong", district: "7 Makara" },
  "Ou Ruessei Ti Muoy": { name: "Ou Ruessei 1", district: "7 Makara" },
  "Ou Ruessei Ti Pir": { name: "Ou Ruessei 2", district: "7 Makara" },
  "Ou Ruessei Ti Bei": { name: "Ou Ruessei 3", district: "7 Makara" },
  "Ou Ruessei Ti Buon": { name: "Ou Ruessei 4", district: "7 Makara" },
  "Phsar Depou Ti Muoy": { name: "Phsar Depou 1", district: "7 Makara" },
  "Phsar Depou Ti Pir": { name: "Phsar Depou 2", district: "7 Makara" },
  "Phsar Depou Ti Bei": { name: "Phsar Depou 3", district: "7 Makara" },
  "Phsar Daeum Kor": { name: "Phsar Daeum Kor", district: "7 Makara" },
  "Boeng Salang": { name: "Boeng Salang", district: "7 Makara" },

  /* ── Toul Kork sangkats ──────────────────────────────── */
  "Boeng Kak Ti Muoy": { name: "Boeng Kak 1", district: "Toul Kork" },
  "Boeng Kak Ti Pir": { name: "Boeng Kak 2", district: "Toul Kork" },
  "Tuol Sangke": { name: "Tuol Sangke", district: "Toul Kork" },
  // Tuek L'ak — full names in source data
  "Tuek L'ak Ti Muoy": { name: "Tuek Lak 1", district: "Toul Kork" },
  "Tuek L'ak Ti Pir": { name: "Tuek Lak 2", district: "Toul Kork" },
  "Tuek L'ak Ti Bei": { name: "Tuek Lak 3", district: "Toul Kork" },

  /* ── Sen Sok sangkats ────────────────────────────────── */
  "Phnom Penh Thmei": { name: "Phnom Penh Thmei", district: "Sen Sok" },
  "Tuek Thla": { name: "Tuek Thla", district: "Sen Sok" },
  Khmuonh: { name: "Khmuonh", district: "Sen Sok" },
  "Krang Thnong": { name: "Krang Thnong", district: "Sen Sok" },

  /* ── Russey Keo sangkats ─────────────────────────────── */
  "Ruessei Kaev": { name: "Ruessei Kaev", district: "Russey Keo" },
  "Svay Pak": { name: "Svay Pak", district: "Russey Keo" },
  "Preaek Ta Sek": { name: "Preaek Ta Sek", district: "Russey Keo" },
  "Preaek Lieb": { name: "Preaek Lieb", district: "Russey Keo" },
  // Chrang Chamreh — truncated in source data
  "Chrang Chamreh Ti M*": { name: "Chrang Chamreh 1", district: "Russey Keo" },
  "Chrang Chamreh Ti P*": { name: "Chrang Chamreh 2", district: "Russey Keo" },
  // Km 6 — truncated in source data
  "Kilomaetr Lekh Pram*": { name: "Km 6", district: "Russey Keo" },

  /* ── Chroy Changvar sangkats ─────────────────────────── */
  "Chrouy Changvar": { name: "Chrouy Changvar", district: "Chroy Changvar" },
  "Kaoh Dach": { name: "Kaoh Dach", district: "Chroy Changvar" },
  "Preaek Ampil": { name: "Preaek Ampil", district: "Chroy Changvar" },
  "Svay Chrum": { name: "Svay Chrum", district: "Chroy Changvar" },
  // Preaek Ta Kov — lowercase k in source data
  "Preaek Ta kov": { name: "Preaek Ta Kov", district: "Chroy Changvar" },

  /* ── Meanchey sangkats ───────────────────────────────── */
  "Boeng Tumpun": { name: "Boeng Tumpun", district: "Meanchey" },
  "Phsar Daeum Thkov": { name: "Phsar Daeum Thkov", district: "Meanchey" },
  "Chak Angrae Leu": { name: "Chak Angrae Leu", district: "Meanchey" },
  "Chak Angrae Kraom": { name: "Chak Angrae Kraom", district: "Meanchey" },

  /* ── Stung Meanchey sangkats ─────────────────────────── */
  "Stueng Mean chey": { name: "Stueng Meanchey", district: "Stung Meanchey" },

  /* ── Chbar Ampov sangkats ────────────────────────────── */
  "Chhbar Ampov Ti Muoy": { name: "Chbar Ampov 1", district: "Chbar Ampov" },
  "Chbar Ampov Ti Pir": { name: "Chbar Ampov 2", district: "Chbar Ampov" },
  Nirouth: { name: "Nirouth", district: "Chbar Ampov" },
  "Preaek Pra": { name: "Preaek Pra", district: "Chbar Ampov" },
  "Veal Sbov": { name: "Veal Sbov", district: "Chbar Ampov" },
  "Preaek Aeng": { name: "Preaek Aeng", district: "Chbar Ampov" },

  /* ── Por Sen Chey sangkats ───────────────────────────── */
  "Chaom Chau": { name: "Chaom Chau", district: "Por Sen Chey" },
  Kakab: { name: "Kakab", district: "Por Sen Chey" },

  /* ── Kamboul sangkats ────────────────────────────────── */
  "Pong Tuek": { name: "Pong Tuek", district: "Kamboul" },
  "Prey Veaeng": { name: "Prey Veaeng", district: "Kamboul" },
  "Sak Sampov": { name: "Sak Sampov", district: "Kamboul" },

  /* ── Dangkao sangkats ────────────────────────────────── */
  Dangkao: { name: "Dangkao", district: "Dangkao" },
  "Prey Sa": { name: "Prey Sa", district: "Dangkao" },
  "Spean Thma": { name: "Spean Thma", district: "Dangkao" },
  "Cheung Aek": { name: "Cheung Aek", district: "Dangkao" },
  "Preaek Kampues": { name: "Preaek Kampues", district: "Dangkao" },
  "Prek Ruessey": { name: "Prek Ruessey", district: "Dangkao" },

  /* ── Prek Pnov sangkats ──────────────────────────────── */
  "Preaek Phnov": { name: "Preaek Phnov", district: "Prek Pnov" },
  "Kaoh Oknha Tei": { name: "Kaoh Oknha Tei", district: "Prek Pnov" },
};

/**
 * BKK features have identical truncated names in geoBoundaries.
 * Disambiguate by full shapeID → sangkat info.
 */
const BKK_BY_ID: Record<string, SangkatInfo> = {
  "89927896B73048198705496": { name: "BKK1", district: "Chamkar Mon" },
  "89927896B68782742352730": { name: "BKK2", district: "Chamkar Mon" },
  "89927896B61351852717763": { name: "BKK3", district: "Chamkar Mon" },
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

/* ── PP bounding box — reject ADM3 features outside PP ── */

const PP_BBOX = {
  minLat: 11.43,
  maxLat: 11.70,
  minLng: 104.78,
  maxLng: 105.02,
};

/* ── Resolve PP ADM3 feature → sangkat info ────────────── */

function resolvePPSangkat(feature: any): SangkatInfo | null {
  const shapeName: string = feature.properties.shapeName;
  const shapeID: string = feature.properties.shapeID;

  // 1. BKK by shapeID (all 3 have identical truncated shapeName)
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

  // 3. Direct name match (includes truncated names like "Chrang Chamreh Ti M*")
  if (PP_ADM3_MAP[shapeName]) return PP_ADM3_MAP[shapeName];

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

  /* ── 2. Phnom Penh — individual ADM3 sangkats ── */

  const ppFeatures: any[] = [];
  const ppDistrictCounts = new Map<string, number>();

  for (const f of adm3.features) {
    const info = resolvePPSangkat(f);
    if (!info) continue;
    ppDistrictCounts.set(
      info.district,
      (ppDistrictCounts.get(info.district) || 0) + 1,
    );
    ppFeatures.push({
      type: "Feature",
      properties: {
        name: info.name,
        district: info.district,
        zone: "phnom-penh",
      },
      geometry: f.geometry,
    });
  }

  const ppDistricts = new Set(ppDistrictCounts.keys());
  console.log(
    `  PP sangkats: ${ppFeatures.length} ADM3 features across ${ppDistricts.size} districts`,
  );
  for (const [district, count] of [...ppDistrictCounts.entries()].sort()) {
    console.log(`    ${district.padEnd(20)} ← ${count} sangkat(s)`);
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
