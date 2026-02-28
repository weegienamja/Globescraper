/**
 * Build a hybrid Cambodia GeoJSON:
 * - ADM2 (district) for all of Cambodia EXCEPT Phnom Penh khans and Siem Reap
 * - Hand-drawn sangkat polygons for Phnom Penh inner city
 * - ADM3 sangkat polygons for the Siem Reap district area
 *
 * Run once: npx tsx scripts/build-cambodia-geojson.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const ADM2_PATH = join(ROOT, "data/cambodia-adm2-simplified.geojson");
const ADM3_PATH = join(ROOT, "data/cambodia-adm3-simplified.geojson");
const OUT_PATH = join(ROOT, "public/geo/cambodia-districts.geojson");

/* ── ADM2 features to EXCLUDE (Phnom Penh khans — replaced by hand-drawn) ── */
const PP_KHANS = new Set([
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

/* ── ADM2 "Siem Reap" to EXCLUDE (replaced by ADM3 sangkats) ── */
const SR_ADM2_EXCLUDE = new Set(["Siem Reap"]);

/* ── ADM3 shapeNames to INCLUDE for Siem Reap area ── */
const SR_SANGKATS = new Set([
  // Core city sangkats (in SR ADM2 bounding box)
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
  // Border sangkats (edge of SR district)
  "Leang Dai",
  "Doun Kaev",
  "Preah Dak",
  "Kaev Poar",
  "Bakong",
]);

/** Siem Reap area bounding box — used to disambiguate duplicate names */
const SR_BBOX = {
  minLat: 13.20, maxLat: 13.52,
  minLng: 103.69, maxLng: 104.02,
};

/** Compute centroid from GeoJSON coordinates */
function centroid(feature: any): [number, number] {
  const geom = feature.geometry;
  const ring =
    geom.type === "MultiPolygon"
      ? geom.coordinates[0][0]
      : geom.coordinates[0];
  const n = ring.length;
  let latS = 0, lngS = 0;
  for (let i = 0; i < n; i++) {
    lngS += ring[i][0];
    latS += ring[i][1];
  }
  return [latS / n, lngS / n];
}

/* ── ADM3 Siem Reap shapeName → canonical display name ── */
const SR_RENAME: Record<string, string> = {
  "Siem Reab": "Siem Reap",
  "Sngkat Sambuor": "Sambuor",
};

/* ── ADM2 shapeName → canonical display name ── */
const ADM2_RENAME: Record<string, string> = {
  "Kaeb": "Kep",
  "Khemara Phoumin": "Sihanoukville",
  "Stueng Hav": "Stueng Hav",
  "Preah Sihanouk": "Preah Sihanouk",
  "Stueng Saen": "Stueng Saen",
  "Stueng Traeng": "Stueng Traeng",
};

/* ── Hand-drawn Phnom Penh sangkat/khan polygons ── */
interface DistrictDef {
  name: string;
  coords: [number, number][];
}

const PP_DISTRICTS: DistrictDef[] = [
  {
    name: "BKK1",
    coords: [
      [104.9200, 11.5530], [104.9210, 11.5585], [104.9215, 11.5625],
      [104.9280, 11.5625], [104.9275, 11.5580], [104.9270, 11.5530],
      [104.9240, 11.5525], [104.9200, 11.5530],
    ],
  },
  {
    name: "BKK2",
    coords: [
      [104.9200, 11.5440], [104.9200, 11.5480], [104.9200, 11.5530],
      [104.9240, 11.5525], [104.9270, 11.5530], [104.9280, 11.5440],
      [104.9240, 11.5435], [104.9200, 11.5440],
    ],
  },
  {
    name: "BKK3",
    coords: [
      [104.9080, 11.5440], [104.9085, 11.5500], [104.9080, 11.5530],
      [104.9090, 11.5580], [104.9100, 11.5625], [104.9215, 11.5625],
      [104.9210, 11.5585], [104.9200, 11.5530], [104.9200, 11.5480],
      [104.9200, 11.5440], [104.9140, 11.5438], [104.9080, 11.5440],
    ],
  },
  {
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
    name: "Toul Tom Poung",
    coords: [
      [104.9080, 11.5360], [104.9075, 11.5400], [104.9080, 11.5440],
      [104.9140, 11.5438], [104.9200, 11.5440], [104.9240, 11.5435],
      [104.9280, 11.5440], [104.9300, 11.5420], [104.9340, 11.5360],
      [104.9280, 11.5340], [104.9200, 11.5350], [104.9140, 11.5355],
      [104.9080, 11.5360],
    ],
  },
  {
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
  {
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

/* ── Build ── */

function main() {
  console.log("Reading ADM2 data...");
  const adm2 = JSON.parse(readFileSync(ADM2_PATH, "utf-8"));
  console.log(`  Total ADM2 features: ${adm2.features.length}`);

  // Filter out PP khans AND the SR ADM2 feature
  const nonPP = adm2.features.filter(
    (f: any) =>
      !PP_KHANS.has(f.properties.shapeName) &&
      !SR_ADM2_EXCLUDE.has(f.properties.shapeName),
  );
  console.log(`  Non-PP/SR ADM2 features: ${nonPP.length}`);
  console.log(`  Removed: ${adm2.features.length - nonPP.length} (PP khans + SR ADM2)`);

  // Normalize properties: use { name: "..." } for all features
  const adm2Features = nonPP.map((f: any) => {
    const rawName = f.properties.shapeName;
    const name = ADM2_RENAME[rawName] || rawName;
    return {
      type: "Feature",
      properties: { name },
      geometry: f.geometry,
    };
  });

  // Convert hand-drawn PP polygons to GeoJSON features
  const ppFeatures = PP_DISTRICTS.map((d) => ({
    type: "Feature",
    properties: { name: d.name, zone: "phnom-penh" },
    geometry: {
      type: "Polygon",
      coordinates: [d.coords],
    },
  }));

  // Read ADM3 and extract Siem Reap sangkats
  console.log("\nReading ADM3 data...");
  const adm3 = JSON.parse(readFileSync(ADM3_PATH, "utf-8"));
  console.log(`  Total ADM3 features: ${adm3.features.length}`);

  const srFeatures = adm3.features
    .filter((f: any) => {
      if (!SR_SANGKATS.has(f.properties.shapeName)) return false;
      // Disambiguate by centroid — only include those in SR area
      const [lat, lng] = centroid(f);
      return (
        lat >= SR_BBOX.minLat && lat <= SR_BBOX.maxLat &&
        lng >= SR_BBOX.minLng && lng <= SR_BBOX.maxLng
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
  console.log(`  SR sangkat features: ${srFeatures.length}`);

  // Combine
  const combined = {
    type: "FeatureCollection",
    features: [...adm2Features, ...ppFeatures, ...srFeatures],
  };

  console.log(`\n  PP hand-drawn features: ${ppFeatures.length}`);
  console.log(`  SR ADM3 features: ${srFeatures.length}`);
  console.log(`  Total combined features: ${combined.features.length}`);

  // Write
  mkdirSync(join(ROOT, "public/geo"), { recursive: true });
  const json = JSON.stringify(combined);
  writeFileSync(OUT_PATH, json);
  console.log(`\nWrote ${(json.length / 1024).toFixed(1)} KB → ${OUT_PATH}`);
}

main();
