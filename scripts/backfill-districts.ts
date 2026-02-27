/**
 * Backfill script: re-normalize all district values in RentalListing
 * to canonical names matching GeoJSON polygons.
 *
 * Usage: npx tsx scripts/backfill-districts.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";
import { parseDistrict } from "../lib/rentals/parse";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const listings = await prisma.rentalListing.findMany({
    where: { district: { not: null } },
    select: { id: true, district: true },
  });

  console.log(`Found ${listings.length} listings with a district value`);
  if (dryRun) console.log("(DRY RUN — no DB writes)\n");

  let updated = 0;
  let unchanged = 0;
  const changes: { from: string; to: string; count: number }[] = [];
  const changeMap = new Map<string, { to: string; count: number }>();

  for (const l of listings) {
    const canonical = parseDistrict(l.district);
    if (canonical && canonical !== l.district) {
      const key = `${l.district} → ${canonical}`;
      if (!changeMap.has(key)) changeMap.set(key, { to: canonical, count: 0 });
      changeMap.get(key)!.count++;

      if (!dryRun) {
        await prisma.rentalListing.update({
          where: { id: l.id },
          data: { district: canonical },
        });
      }
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log("\n=== District normalization changes ===");
  const sorted = [...changeMap.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [change, { count }] of sorted) {
    console.log(`  ${change}  (${count})`);
  }

  console.log(`\nUpdated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  if (dryRun) console.log("\nRe-run without --dry-run to apply changes.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
