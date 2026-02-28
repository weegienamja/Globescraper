/**
 * Recovery backfill: re-extract Siem Reap sangkat names from listing URLs.
 *
 * The previous backfill collapsed all SR sangkats to "Siem Reap".
 * This script recovers individual sangkat names by:
 *   1. For realestate.com.kh URLs: extracting district from /rent/<district>/...
 *   2. For khmer24 URLs: attempting to extract from slug text
 *
 * Usage: npx tsx scripts/backfill-sr-sangkats.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";
import { parseDistrict } from "../lib/rentals/parse";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

/** Known SR sangkat slugs found in realestate.com.kh URLs */
const URL_SLUG_MAP: Record<string, string> = {
  "sala-kamreuk": "Sala Kamraeuk",
  "sala-kamraeuk": "Sala Kamraeuk",
  "svay-dankum": "Svay Dankum",
  "sla-kram": "Sla Kram",
  "kouk-chak": "Kouk Chak",
  "kok-chak": "Kouk Chak",
  "chreav": "Chreav",
  "siem-reap": "Siem Reap",
  "siem-reab": "Siem Reap",
  "srangae": "Srangae",
  "nokor-thum": "Nokor Thum",
  "krabei-riel": "Krabei Riel",
  "khnat": "Khnat",
  "tuek-vil": "Tuek Vil",
  "bakong": "Prasat Bakong",
  "prasat-bakong": "Prasat Bakong",
  "sambuor": "Sambuor",
  "roluos": "Roluos",
  "ampil": "Ampil",
  "kampong-phluk": "Kampong Phluk",
  "chong-khnies": "Chong Khnies",
  "kandaek": "Kandaek",
};

function extractDistrictFromUrl(url: string): string | null {
  try {
    const u = new URL(url);

    // realestate.com.kh: /rent/<district-slug>/<listing-slug>
    if (u.hostname.includes("realestate")) {
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments[0] === "rent" && segments.length >= 3) {
        const slug = segments[1];
        if (URL_SLUG_MAP[slug]) return URL_SLUG_MAP[slug];
        // Try converting slug to text for parseDistrict
        const text = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        return text;
      }
    }

    // khmer24: /en/<slug>-adid-<digits> — district not in URL, but try title slug 
    if (u.hostname.includes("khmer24")) {
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length >= 2) {
        const slug = segments[segments.length - 1].replace(/-adid-\d+$/, "");
        // Check if slug contains a known sangkat keyword
        for (const [key, val] of Object.entries(URL_SLUG_MAP)) {
          if (slug.includes(key)) return val;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {
  // Find all SR listings that are collapsed to "Siem Reap"
  const listings = await prisma.rentalListing.findMany({
    where: {
      district: "Siem Reap",
      city: "Siem Reap",
    },
    select: { id: true, district: true, canonicalUrl: true, source: true },
  });

  console.log(`Found ${listings.length} Siem Reap listings to check`);
  if (dryRun) console.log("(DRY RUN — no DB writes)\n");

  let recovered = 0;
  let unchanged = 0;
  const changeMap = new Map<string, number>();

  for (const l of listings) {
    // Try to extract district from URL
    const urlDistrict = extractDistrictFromUrl(l.canonicalUrl);
    if (!urlDistrict) {
      unchanged++;
      continue;
    }

    // Parse through our aliases to get canonical name
    const canonical = parseDistrict(urlDistrict);
    if (!canonical || canonical === "Siem Reap") {
      unchanged++;
      continue;
    }

    const key = `Siem Reap → ${canonical}`;
    changeMap.set(key, (changeMap.get(key) || 0) + 1);

    if (!dryRun) {
      await prisma.rentalListing.update({
        where: { id: l.id },
        data: { district: canonical },
      });
    }
    recovered++;
  }

  console.log("\n=== SR sangkat recovery ===");
  const sorted = [...changeMap.entries()].sort((a, b) => b[1] - a[1]);
  for (const [change, count] of sorted) {
    console.log(`  ${change}  (${count})`);
  }

  console.log(`\nRecovered: ${recovered}`);
  console.log(`Unchanged: ${unchanged} (kept as "Siem Reap")`);
  if (dryRun) console.log("\nRe-run without --dry-run to apply changes.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
