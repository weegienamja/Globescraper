/**
 * Script: Reclassify mistyped listings
 *
 * Scans all active listings and re-runs the property type classifier
 * against title + URL to catch non-residential properties that were
 * uploaded under the wrong category (e.g. warehouse listed as apartment).
 *
 * Modes:
 *   --dry-run       Preview changes without writing to DB (default)
 *   --apply         Actually apply changes (deactivate non-residential,
 *                   correct misclassified types)
 *   --source X      Only check listings from a specific source
 *   --verbose       Show every listing being checked
 *
 * Usage:
 *   npx tsx scripts/reclassify-listings.ts                 # dry run
 *   npx tsx scripts/reclassify-listings.ts --apply         # apply changes
 *   npx tsx scripts/reclassify-listings.ts --source REALESTATE_KH
 */

const DRY_RUN = !process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");
const SOURCE_FILTER = (() => {
  const idx = process.argv.indexOf("--source");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

import { prisma } from "../lib/prisma";
import { PropertyType, RentalSource } from "@prisma/client";
import {
  classifyPropertyType,
  isTitleNonResidential,
  reclassifyPropertyType,
} from "../lib/rentals/classify";

interface ReclassifyResult {
  deactivated: { id: string; title: string; oldType: PropertyType; reason: string }[];
  reclassified: { id: string; title: string; oldType: PropertyType; newType: PropertyType }[];
  unchanged: number;
}

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  Reclassify Mistyped Listings                     ║");
  console.log(`║  Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "⚠️  APPLY (writing to DB)"}`.padEnd(53) + "║");
  if (SOURCE_FILTER) {
    console.log(`║  Source filter: ${SOURCE_FILTER}`.padEnd(53) + "║");
  }
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Fetch all active listings
  const where: Record<string, unknown> = { isActive: true };
  if (SOURCE_FILTER) {
    where.source = SOURCE_FILTER as RentalSource;
  }

  const listings = await prisma.rentalListing.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      canonicalUrl: true,
      source: true,
      propertyType: true,
      district: true,
      priceMonthlyUsd: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  console.log(`Scanning ${listings.length} active listings…\n`);

  const result: ReclassifyResult = {
    deactivated: [],
    reclassified: [],
    unchanged: 0,
  };

  for (const listing of listings) {
    const urlSlug = listing.canonicalUrl.toLowerCase();
    const newType = reclassifyPropertyType(listing.title, listing.description, urlSlug);

    if (newType === null) {
      // Should be non-residential → deactivate
      const reason = isTitleNonResidential(listing.title)
        ? "title contains non-residential keywords"
        : "classifier rejected as non-residential";

      result.deactivated.push({
        id: listing.id,
        title: listing.title,
        oldType: listing.propertyType,
        reason,
      });

      if (!DRY_RUN) {
        await prisma.rentalListing.update({
          where: { id: listing.id },
          data: { isActive: false },
        });
      }
    } else if (newType !== listing.propertyType) {
      // Type changed — reclassify
      result.reclassified.push({
        id: listing.id,
        title: listing.title,
        oldType: listing.propertyType,
        newType,
      });

      if (!DRY_RUN) {
        await prisma.rentalListing.update({
          where: { id: listing.id },
          data: { propertyType: newType },
        });
      }
    } else {
      result.unchanged++;
      if (VERBOSE) {
        console.log(`  ✓ ${listing.title.slice(0, 60)} — ${listing.propertyType} (OK)`);
      }
    }
  }

  // Report
  console.log("\n┌────────────────────────────────────────────────────┐");
  console.log(`│  Scanned:       ${String(listings.length).padStart(6)} active listings`);
  console.log(`│  Unchanged:     ${String(result.unchanged).padStart(6)}`);
  console.log(`│  Reclassified:  ${String(result.reclassified.length).padStart(6)}`);
  console.log(`│  Deactivated:   ${String(result.deactivated.length).padStart(6)} (non-residential)`);
  console.log("└────────────────────────────────────────────────────┘");

  if (result.deactivated.length > 0) {
    console.log("\n🚫 Non-residential listings to deactivate:");
    for (const d of result.deactivated) {
      console.log(`  ${DRY_RUN ? "[DRY]" : "[DONE]"} ${d.oldType.padEnd(18)} → DEACTIVATED  "${d.title.slice(0, 70)}"`);
      console.log(`         Reason: ${d.reason}`);
    }
  }

  if (result.reclassified.length > 0) {
    console.log("\n🔄 Reclassified listings:");
    for (const r of result.reclassified) {
      console.log(`  ${DRY_RUN ? "[DRY]" : "[DONE]"} ${r.oldType.padEnd(18)} → ${r.newType.padEnd(18)}  "${r.title.slice(0, 70)}"`);
    }
  }

  if (DRY_RUN && (result.deactivated.length > 0 || result.reclassified.length > 0)) {
    console.log("\n💡 This was a dry run. To apply changes, run:");
    console.log("   npx tsx scripts/reclassify-listings.ts --apply\n");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
