/**
 * Purge all Khmer24 rental data so it can be re-scraped with correct locations.
 *
 * Deletes (in order):
 *   1. RentalIndexDaily  rows where source data came from Khmer24
 *   2. RentalSnapshot    rows for Khmer24 listings (cascaded by listing delete)
 *   3. RentalListing     rows with source = KHMER24
 *   4. ScrapeQueue       rows with source = KHMER24
 *
 * Usage:
 *   npx tsx scripts/purge-khmer24-data.ts          # dry-run (default)
 *   npx tsx scripts/purge-khmer24-data.ts --confirm # actually delete
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = !process.argv.includes("--confirm");

  if (dryRun) {
    console.log("=== DRY RUN (pass --confirm to actually delete) ===\n");
  } else {
    console.log("=== LIVE RUN — DELETING DATA ===\n");
  }

  // Count what we're about to remove
  const listingCount = await prisma.rentalListing.count({
    where: { source: "KHMER24" },
  });
  const listingIds = (
    await prisma.rentalListing.findMany({
      where: { source: "KHMER24" },
      select: { id: true },
    })
  ).map((r) => r.id);

  const snapshotCount = await prisma.rentalSnapshot.count({
    where: { listingId: { in: listingIds } },
  });
  const queueCount = await prisma.scrapeQueue.count({
    where: { source: "KHMER24" },
  });

  // RentalIndexDaily doesn't have a source column, but all rows were built
  // from listings — we'll delete ALL daily index rows and let the next
  // build-index run regenerate them from the remaining (non-Khmer24) data.
  const dailyIndexCount = await prisma.rentalIndexDaily.count();

  console.log(`Khmer24 listings:   ${listingCount}`);
  console.log(`Khmer24 snapshots:  ${snapshotCount}`);
  console.log(`Khmer24 queue rows: ${queueCount}`);
  console.log(`Daily index rows:   ${dailyIndexCount} (will rebuild from remaining sources)`);
  console.log();

  if (dryRun) {
    console.log("No changes made. Run with --confirm to delete.");
    await prisma.$disconnect();
    return;
  }

  // Delete in dependency order
  console.log("Deleting daily index rows...");
  const deletedIndex = await prisma.rentalIndexDaily.deleteMany();
  console.log(`  Deleted ${deletedIndex.count} daily index rows`);

  console.log("Deleting Khmer24 listings (snapshots cascade)...");
  const deletedListings = await prisma.rentalListing.deleteMany({
    where: { source: "KHMER24" },
  });
  console.log(`  Deleted ${deletedListings.count} listings (+ snapshots)`);

  console.log("Deleting Khmer24 queue entries...");
  const deletedQueue = await prisma.scrapeQueue.deleteMany({
    where: { source: "KHMER24" },
  });
  console.log(`  Deleted ${deletedQueue.count} queue entries`);

  console.log("\nDone. Run a bulk scrape to repopulate:");
  console.log("  npx tsx scripts/rentals_bulk_scrape.ts KHMER24 --max-pages 10 --max-process 200");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
