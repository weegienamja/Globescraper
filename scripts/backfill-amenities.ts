/**
 * Backfill amenities on existing RentalListing rows.
 *
 * Parses amenities from the stored description + title and writes them
 * to amenitiesJson for listings that don't already have it.
 *
 * Usage:  npx tsx scripts/backfill-amenities.ts
 */

import { prisma } from "../lib/prisma";
import { parseAmenities } from "../lib/rentals/parse";

async function main() {
  const listings = await prisma.rentalListing.findMany({
    where: { amenitiesJson: null },
    select: { id: true, title: true, description: true },
  });

  console.log(`Found ${listings.length} listings without amenities — backfilling…`);

  let updated = 0;
  let withAmenities = 0;

  for (const l of listings) {
    const text = `${l.title} ${l.description ?? ""}`;
    const amenities = parseAmenities(text);
    const amenitiesJson = amenities.length > 0 ? JSON.stringify(amenities) : null;

    await prisma.rentalListing.update({
      where: { id: l.id },
      data: { amenitiesJson },
    });

    updated++;
    if (amenities.length > 0) withAmenities++;
  }

  console.log(`✔ Updated ${updated} listings — ${withAmenities} had amenities extracted`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
