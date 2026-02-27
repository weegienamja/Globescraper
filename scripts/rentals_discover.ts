/**
 * Script: Discover rental listings from all enabled sources.
 *
 * Usage: npx tsx scripts/rentals_discover.ts [KHMER24|REALESTATE_KH]
 * If no source specified, runs both enabled sources.
 */

import { RentalSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { discoverListingsJob } from "../lib/rentals/jobs/discover";
import { isSourceEnabled } from "../lib/rentals/config";

async function main() {
  const arg = process.argv[2]?.toUpperCase();
  const sources: RentalSource[] = arg
    ? [arg as RentalSource]
    : (["KHMER24", "REALESTATE_KH"] as RentalSource[]);

  console.log("[rentals_discover] Starting discover job...");

  for (const source of sources) {
    if (!isSourceEnabled(source)) {
      console.log(`[rentals_discover] Source ${source} is disabled, skipping.`);
      continue;
    }

    console.log(`[rentals_discover] Discovering listings from ${source}...`);
    const result = await discoverListingsJob(source);
    console.log(`[rentals_discover] ${source} complete:`, {
      discovered: result.discovered,
      queued: result.queued,
      skippedDuplicate: result.skippedDuplicate,
      jobRunId: result.jobRunId,
    });
  }

  console.log("[rentals_discover] Done.");
}

main()
  .catch((err) => {
    console.error("[rentals_discover] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
