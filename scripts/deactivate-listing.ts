import { prisma } from "../lib/prisma";

const url = process.argv[2];
if (!url) {
  console.log("Usage: npx tsx scripts/deactivate-listing.ts <url-or-id-fragment>");
  process.exit(1);
}

async function main() {
  // Try matching by URL fragment or listing ID
  const listing = await prisma.rentalListing.findFirst({
    where: {
      OR: [
        { canonicalUrl: { contains: url } },
        { sourceListingId: url },
        { id: url },
      ],
    },
    select: { id: true, title: true, propertyType: true, isActive: true, manualOverride: true, canonicalUrl: true },
  });

  if (!listing) {
    console.log("No listing found matching:", url);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("Found:", listing.title);
  console.log("  Type:", listing.propertyType, "| Active:", listing.isActive);
  console.log("  URL:", listing.canonicalUrl);

  if (!listing.isActive && listing.manualOverride) {
    console.log("Already deactivated with manual override.");
  } else {
    await prisma.rentalListing.update({
      where: { id: listing.id },
      data: { isActive: false, manualOverride: true },
    });
    console.log("\u2713 Deactivated (manual override \u2014 scraper will not reactivate).");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
