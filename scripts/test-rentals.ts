import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check admin user
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { email: true, id: true },
  });
  console.log("Admin user:", JSON.stringify(admin));

  // Test DB models exist
  const listingCount = await prisma.rentalListing.count();
  const snapshotCount = await prisma.rentalSnapshot.count();
  const queueCount = await prisma.scrapeQueue.count();
  const jobRunCount = await prisma.jobRun.count();
  const indexCount = await prisma.rentalIndexDaily.count();

  console.log("DB Model Check:");
  console.log("  RentalListing:", listingCount);
  console.log("  RentalSnapshot:", snapshotCount);
  console.log("  ScrapeQueue:", queueCount);
  console.log("  JobRun:", jobRunCount);
  console.log("  RentalIndexDaily:", indexCount);

  // Test URL canonicalization
  const { canonicalizeUrl } = await import("../lib/rentals/url");
  console.log("\nURL Canonicalization:");
  console.log("  ", canonicalizeUrl("https://www.Khmer24.com/en/apartment-rent-123.html?utm_source=google&ref=foo"));
  console.log("  ", canonicalizeUrl("https://www.realestate.com.kh/rent/condos/123/?fbclid=abc"));

  // Test classifier
  const { classifyPropertyType, shouldIngest } = await import("../lib/rentals/classify");
  console.log("\nClassifier Tests:");
  const tests = [
    { title: "Beautiful 2BR Condo BKK1", desc: "" },
    { title: "Apartment for Rent Tonle Bassac", desc: "nice apartment" },
    { title: "Villa for Rent", desc: "luxury villa" },
    { title: "Shophouse commercial", desc: "" },
    { title: "Studio apartment near TTP", desc: "studio" },
    { title: "Land for sale", desc: "" },
  ];
  for (const t of tests) {
    const pt = classifyPropertyType(t.title, t.desc);
    console.log(`  "${t.title}" → ${pt} (ingest: ${shouldIngest(pt)})`);
  }

  // Test price parser
  const { parsePriceMonthlyUsd } = await import("../lib/rentals/parse");
  console.log("\nPrice Parser:");
  const prices = ["$800/month", "USD 1,200 per month", "$50/night", "1500$/mo", "$25", "$80000"];
  for (const p of prices) {
    console.log(`  "${p}" → ${parsePriceMonthlyUsd(p)}`);
  }

  // Test fingerprint
  const { computeFingerprint } = await import("../lib/rentals/fingerprint");
  console.log("\nFingerprint:");
  const fp = computeFingerprint({
    title: "2BR Condo BKK1",
    district: "BKK1",
    bedrooms: 2,
    propertyType: "CONDO",
    priceMonthlyUsd: 800,
    firstImageUrl: "https://example.com/img.jpg",
  });
  console.log("  hash:", fp.substring(0, 20) + "...");

  await prisma.$disconnect();
  console.log("\n✓ All checks passed!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
