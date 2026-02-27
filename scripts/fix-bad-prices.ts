/**
 * Fix bad price data: listings where a sale price was stored as monthly rent.
 *
 * This script:
 *  1. Finds RentalListing & RentalSnapshot records with priceMonthlyUsd > $10,000
 *     (these are almost certainly sale prices, not monthly rents).
 *  2. Nulls out the bad priceMonthlyUsd values.
 *  3. Resets corresponding ScrapeQueue entries to PENDING so the
 *     fixed scraper can re-scrape and store the correct rental price.
 *
 * Usage:
 *   npx tsx scripts/fix-bad-prices.ts          # dry run (shows what would change)
 *   npx tsx scripts/fix-bad-prices.ts --apply   # actually apply changes
 */

import { PrismaClient, QueueStatus } from "@prisma/client";

const THRESHOLD = 10_000; // $10k/mo is unreasonably high for Cambodia rentals

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const prisma = new PrismaClient();

  try {
    if (dryRun) {
      console.log("🔍 DRY RUN — pass --apply to commit changes\n");
    }

    // 1. Find bad listings
    const badListings = await prisma.rentalListing.findMany({
      where: { priceMonthlyUsd: { gt: THRESHOLD } },
      select: {
        id: true,
        canonicalUrl: true,
        title: true,
        priceMonthlyUsd: true,
        source: true,
      },
    });

    console.log(
      `Found ${badListings.length} listings with priceMonthlyUsd > $${THRESHOLD.toLocaleString()}\n`
    );
    for (const l of badListings) {
      console.log(
        `  $${l.priceMonthlyUsd?.toLocaleString()}/mo  ${l.title?.slice(0, 60)}  ${l.canonicalUrl}`
      );
    }

    // 2. Find bad snapshots
    const badSnapshots = await prisma.rentalSnapshot.findMany({
      where: { priceMonthlyUsd: { gt: THRESHOLD } },
      select: { id: true, listingId: true, priceMonthlyUsd: true },
    });

    console.log(
      `\nFound ${badSnapshots.length} snapshots with priceMonthlyUsd > $${THRESHOLD.toLocaleString()}`
    );

    if (!dryRun && (badListings.length > 0 || badSnapshots.length > 0)) {
      // 3. Null out bad prices on listings
      const listingResult = await prisma.rentalListing.updateMany({
        where: { priceMonthlyUsd: { gt: THRESHOLD } },
        data: { priceMonthlyUsd: null },
      });
      console.log(`\n✓ Nulled priceMonthlyUsd on ${listingResult.count} listings`);

      // 4. Null out bad prices on snapshots
      const snapResult = await prisma.rentalSnapshot.updateMany({
        where: { priceMonthlyUsd: { gt: THRESHOLD } },
        data: { priceMonthlyUsd: null },
      });
      console.log(`✓ Nulled priceMonthlyUsd on ${snapResult.count} snapshots`);

      // 5. Reset queue entries for affected listings to PENDING
      const badUrls = badListings.map((l) => l.canonicalUrl);
      if (badUrls.length > 0) {
        const queueResult = await prisma.scrapeQueue.updateMany({
          where: {
            canonicalUrl: { in: badUrls },
            status: QueueStatus.DONE,
          },
          data: { status: QueueStatus.PENDING },
        });
        console.log(
          `✓ Reset ${queueResult.count} queue entries to PENDING for re-scraping`
        );
      }

      console.log(
        "\n✅ Done! Run the pipeline (process-queue → build-index) to re-scrape these listings with the fixed price parser."
      );
    } else if (dryRun && (badListings.length > 0 || badSnapshots.length > 0)) {
      console.log("\n⚠ Run with --apply to fix these records.");
    } else {
      console.log("\n✅ No bad data found — nothing to fix!");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
