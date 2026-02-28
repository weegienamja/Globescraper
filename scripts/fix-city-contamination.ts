/**
 * One-time script: fix cross-contaminated city data.
 * Listings with city "Phnom Penh" but district belonging to another city.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  // Fix SHV listings: city PP but district Sihanoukville → city = Sihanoukville
  const r1 = await p.rentalListing.updateMany({
    where: { city: "Phnom Penh", district: "Sihanoukville" },
    data: { city: "Sihanoukville" },
  });
  console.log("Fixed SHV listings:", r1.count);

  // Fix Kampong Chhnang listing
  const r2 = await p.rentalListing.updateMany({
    where: { city: "Phnom Penh", district: { contains: "Kampong Chhnang" } },
    data: { city: "Kompong Cham" },
  });
  console.log("Fixed Kampong Chhnang listings:", r2.count);

  // Delete bad index rows for these (will be rebuilt by next index build)
  const r3 = await p.rentalIndexDaily.deleteMany({
    where: { city: "Phnom Penh", district: "Sihanoukville" },
  });
  console.log("Deleted SHV index rows:", r3.count);

  const r4 = await p.rentalIndexDaily.deleteMany({
    where: { city: "Phnom Penh", district: { contains: "Kampong Chhnang" } },
  });
  console.log("Deleted Kampong Chhnang index rows:", r4.count);

  // Verify
  const check = await p.rentalIndexDaily.groupBy({
    by: ["city", "district"],
    _count: { id: true },
  });
  const bad = check.filter((r) => {
    const d = (r.district || "").toLowerCase();
    return (
      r.city === "Phnom Penh" &&
      (d.includes("sihanoukville") || d.includes("kampong chhnang"))
    );
  });
  console.log("Remaining bad PP index rows:", bad.length);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
