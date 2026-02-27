/**
 * Script: Build daily rental price index.
 *
 * Usage: npx tsx scripts/rentals_build_index.ts
 * Computes aggregate stats for yesterday UTC by default.
 */

import { prisma } from "../lib/prisma";
import { buildDailyIndexJob } from "../lib/rentals/jobs/buildIndex";

async function main() {
  console.log("[rentals_build_index] Starting build-index job...");

  const result = await buildDailyIndexJob();
  console.log("[rentals_build_index] Complete:", {
    indexRows: result.indexRows,
    jobRunId: result.jobRunId,
  });

  console.log("[rentals_build_index] Done.");
}

main()
  .catch((err) => {
    console.error("[rentals_build_index] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
