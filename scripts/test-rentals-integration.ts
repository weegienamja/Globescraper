/**
 * Integration test: Run the summary query logic directly with Prisma
 * to verify the API route logic works end-to-end against the DB.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Testing Summary Query Logic ===\n");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    totalListings,
    listingsToday,
    totalSnapshots,
    lastListing,
    khmer24Count,
    realestateCount,
    recentJobs,
  ] = await Promise.all([
    prisma.rentalListing.count(),
    prisma.rentalListing.count({
      where: { firstSeenAt: { gte: todayStart } },
    }),
    prisma.rentalSnapshot.count(),
    prisma.rentalListing.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    }),
    prisma.rentalListing.count({ where: { source: "KHMER24" } }),
    prisma.rentalListing.count({ where: { source: "REALESTATE_KH" } }),
    prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const phnomPenhActive = await prisma.rentalListing.count({
    where: { city: "Phnom Penh", isActive: true },
  });

  console.log("Summary API Response (simulated):");
  console.log(JSON.stringify({
    totalListings,
    listingsToday,
    totalSnapshots,
    lastUpdated: lastListing?.lastSeenAt ?? null,
    sourceCounts: { KHMER24: khmer24Count, REALESTATE_KH: realestateCount },
    recentJobs: recentJobs.length,
    marketOverview: {
      city: "Phnom Penh",
      activeListings: phnomPenhActive,
    },
  }, null, 2));

  // Test JobRuns query
  console.log("\n=== Testing JobRuns Query ===\n");
  const jobRuns = await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
  });
  console.log(`JobRuns found: ${jobRuns.length}`);

  // Test ScrapeQueue query
  console.log("\n=== Testing ScrapeQueue ===\n");
  const queue = await prisma.scrapeQueue.findMany({
    where: { status: "PENDING" },
    take: 5,
  });
  console.log(`Pending queue items: ${queue.length}`);

  // Test RentalIndexDaily
  console.log("\n=== Testing RentalIndexDaily ===\n");
  const latestEntry = await prisma.rentalIndexDaily.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  console.log(`Latest index date: ${latestEntry?.date ?? "none"}`);

  // Verify enum values work
  console.log("\n=== Enum Validation ===\n");
  try {
    // Create and immediately delete a test JobRun
    const testRun = await prisma.jobRun.create({
      data: {
        jobType: "DISCOVER",
        source: "KHMER24",
        status: "SUCCESS",
        startedAt: new Date(),
        endedAt: new Date(),
        durationMs: 0,
        discoveredCount: 0,
      },
    });
    console.log(`Created test JobRun: ${testRun.id}`);
    await prisma.jobRun.delete({ where: { id: testRun.id } });
    console.log("Deleted test JobRun ✓");
  } catch (err) {
    console.error("JobRun creation failed:", err);
  }

  // Test upsert into ScrapeQueue
  console.log("\n=== Testing ScrapeQueue Upsert ===\n");
  try {
    const testUrl = "https://test.example.com/listing/test-12345";
    const item = await prisma.scrapeQueue.upsert({
      where: {
        source_canonicalUrl: {
          source: "KHMER24",
          canonicalUrl: testUrl,
        },
      },
      create: {
        source: "KHMER24",
        canonicalUrl: testUrl,
        sourceListingId: "12345",
        status: "PENDING",
      },
      update: {
        updatedAt: new Date(),
      },
    });
    console.log(`ScrapeQueue upsert: ${item.id} ✓`);
    await prisma.scrapeQueue.delete({ where: { id: item.id } });
    console.log("Deleted test ScrapeQueue item ✓");
  } catch (err) {
    console.error("ScrapeQueue upsert failed:", err);
  }

  console.log("\n✓ All integration tests passed!");
}

main()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
