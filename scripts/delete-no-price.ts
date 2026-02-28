import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.rentalListing.count();
  const noPrice = await prisma.rentalListing.count({ where: { priceMonthlyUsd: null } });
  const bySource = await prisma.rentalListing.groupBy({
    by: ["source"],
    where: { priceMonthlyUsd: null },
    _count: true,
  });
  console.log("Total listings:", total);
  console.log("No price:", noPrice);
  console.log("By source:");
  bySource.forEach((r) => console.log(`  ${r.source}: ${r._count}`));

  // Delete
  const deleted = await prisma.rentalListing.deleteMany({ where: { priceMonthlyUsd: null } });
  console.log(`\nDeleted ${deleted.count} listings with no price (snapshots cascaded).`);

  await prisma.$disconnect();
}
main().catch(console.error);
