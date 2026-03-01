/**
 * AI Review Listings — CLI Script
 *
 * Uses Gemini to audit rental listings for misclassification,
 * non-residential properties, and anomalies.
 *
 * Usage:
 *   npx tsx scripts/ai-review-listings.ts                  # dry run, all unreviewed
 *   npx tsx scripts/ai-review-listings.ts --apply           # persist reviews to DB
 *   npx tsx scripts/ai-review-listings.ts --limit 50        # review only first 50
 *   npx tsx scripts/ai-review-listings.ts --all             # re-review everything
 *   npx tsx scripts/ai-review-listings.ts --flagged         # re-review flagged only
 *   npx tsx scripts/ai-review-listings.ts --source REALESTATE_KH  # filter by source
 *   npx tsx scripts/ai-review-listings.ts --apply-flags     # auto-apply AI suggestions
 *
 * Requires: GEMINI_API_KEY in .env / .env.local
 */

import * as fs from "fs";
import * as path from "path";

/** Lightweight .env loader (no dependency needed). */
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", ".env.local"));

import { runAiReview } from "../lib/rentals/ai-review";
import { prisma } from "../lib/prisma";
import { PropertyType } from "@prisma/client";

const VALID_TYPES = new Set(Object.values(PropertyType));

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const applyFlags = args.includes("--apply-flags");
  const all = args.includes("--all");
  const flagged = args.includes("--flagged");

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 && args[limitIdx + 1]
    ? parseInt(args[limitIdx + 1], 10)
    : undefined;

  const sourceIdx = args.indexOf("--source");
  const source = sourceIdx !== -1 && args[sourceIdx + 1]
    ? args[sourceIdx + 1]
    : undefined;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Gemini AI Listing Review                ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  Mode:   ${apply || applyFlags ? "APPLY" : "DRY RUN"}${" ".repeat(30 - (apply || applyFlags ? 5 : 7))}║`);
  if (limit) console.log(`║  Limit:  ${String(limit).padEnd(31)}║`);
  if (source) console.log(`║  Source: ${source.padEnd(31)}║`);
  if (all) console.log(`║  Scope:  All listings (including reviewed) ║`);
  if (flagged) console.log(`║  Scope:  Flagged listings only            ║`);
  console.log("╚══════════════════════════════════════════╝\n");

  const dryRun = !apply && !applyFlags;

  const result = await runAiReview({
    dryRun,
    unreviewed: !all && !flagged,
    flaggedOnly: flagged,
    limit,
    source,
  });

  // If --apply-flags, auto-apply the suggestions from flagged reviews
  if (applyFlags) {
    console.log("\n── Applying AI suggestions to flagged listings ──\n");

    const flaggedReviews = await prisma.rentalAiReview.findMany({
      where: { flagged: true },
      include: {
        listing: {
          select: { id: true, title: true, propertyType: true, isActive: true, manualOverride: true },
        },
      },
    });

    let deactivated = 0;
    let reclassified = 0;
    let skipped = 0;

    for (const review of flaggedReviews) {
      const l = review.listing;

      // Skip manually overridden listings
      if (l.manualOverride) {
        console.log(`  ⏭ SKIP (manual override) "${l.title.slice(0, 60)}"`);
        skipped++;
        continue;
      }

      // Non-residential — deactivate
      if (!review.isResidential && review.confidence >= 0.7) {
        await prisma.rentalListing.update({
          where: { id: l.id },
          data: { isActive: false },
        });
        console.log(`  🚫 DEACTIVATED "${l.title.slice(0, 60)}"`);
        console.log(`     Reason: ${review.reason}`);
        deactivated++;
        continue;
      }

      // Type correction with high confidence
      if (
        review.suggestedType &&
        VALID_TYPES.has(review.suggestedType) &&
        review.suggestedType !== l.propertyType &&
        review.confidence >= 0.8
      ) {
        await prisma.rentalListing.update({
          where: { id: l.id },
          data: { propertyType: review.suggestedType as PropertyType },
        });
        console.log(
          `  🔄 ${l.propertyType} → ${review.suggestedType} "${l.title.slice(0, 60)}"`
        );
        reclassified++;
        continue;
      }

      skipped++;
    }

    console.log(`\n  Applied: ${deactivated} deactivated, ${reclassified} reclassified, ${skipped} skipped`);
  }

  if (dryRun && !applyFlags) {
    console.log("\n💡 This was a dry run. To apply changes:");
    console.log("   npx tsx scripts/ai-review-listings.ts --apply");
    console.log("   npx tsx scripts/ai-review-listings.ts --apply-flags  (auto-fix flagged)");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
