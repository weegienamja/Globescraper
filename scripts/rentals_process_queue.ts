/**
 * Script: Process queued rental listings from all enabled sources.
 *
 * Usage: npx tsx scripts/rentals_process_queue.ts [KHMER24|REALESTATE_KH]
 * If no source specified, runs both enabled sources.
 */

import { RentalSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { processQueueJob } from "../lib/rentals/jobs/processQueue";
import { isSourceEnabled } from "../lib/rentals/config";

async function main() {
  const arg = process.argv[2]?.toUpperCase();
  const sources: RentalSource[] = arg
    ? [arg as RentalSource]
    : (["KHMER24", "REALESTATE_KH"] as RentalSource[]);

  console.log("[rentals_process_queue] Starting process-queue job...");

  for (const source of sources) {
    if (!isSourceEnabled(source)) {
      console.log(`[rentals_process_queue] Source ${source} is disabled, skipping.`);
      continue;
    }

    console.log(`[rentals_process_queue] Processing queue for ${source}...`);
    const result = await processQueueJob(source);
    console.log(`[rentals_process_queue] ${source} complete:`, {
      processed: result.processed,
      inserted: result.inserted,
      updated: result.updated,
      snapshots: result.snapshots,
      failed: result.failed,
      jobRunId: result.jobRunId,
    });
  }

  console.log("[rentals_process_queue] Done.");
}

main()
  .catch((err) => {
    console.error("[rentals_process_queue] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
