/**
 * Script: Daily Rental Scrape — automated cron / Task Scheduler entry point
 *
 * Runs discover → process queue → build index for ALL enabled sources.
 * Designed to be triggered by Windows Task Scheduler or cron.
 *
 * Since Khmer24 requires Playwright (headless Chromium), this MUST run
 * on a real machine — it cannot run on Vercel serverless.
 *
 * Usage:
 *   npx tsx scripts/rentals_daily_scrape.ts
 *
 * Recommended Task Scheduler setup (Windows):
 *   Action:  powershell.exe
 *   Args:    -NoProfile -ExecutionPolicy Bypass -File "C:\dev\globescraper_nextjs\scripts\run-daily-scrape.ps1"
 *   Trigger: Daily at 06:00 (before you wake up)
 *
 * Defaults (tuned for daily incremental updates, not bulk):
 *   Max pages per source:  10  (catches new listings near the top)
 *   Max URLs per source:   200
 *   Max process per source: 200
 */

/* ── Config — sensible daily defaults ────────────────────── */

process.env.RENTALS_MAX_PAGES  = process.env.RENTALS_MAX_PAGES  ?? "10";
process.env.RENTALS_MAX_URLS   = process.env.RENTALS_MAX_URLS   ?? "200";
process.env.RENTALS_MAX_PROCESS = process.env.RENTALS_MAX_PROCESS ?? "200";

/* ── Imports ─────────────────────────────────────────────── */

import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";
import type { RentalSource } from "@prisma/client";

const SOURCES: RentalSource[] = [
  "REALESTATE_KH",
  "KHMER24",
  "IPS_CAMBODIA",
  "CAMREALTY",
  "LONGTERMLETTINGS",
  "FAZWAZ",
];

/* ── Logger ──────────────────────────────────────────────── */

const log: PipelineLogFn = (level, message) => {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  const tag = level.toUpperCase().padEnd(5);
  console.log(`[${ts}] ${tag} ${message}`);
};

const progress: PipelineProgressFn = () => {
  /* silent — no interactive progress bar in cron mode */
};

/* ── Main ────────────────────────────────────────────────── */

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { discoverListingsJob } = await import("../lib/rentals/jobs/discover");
  const { processQueueJob } = await import("../lib/rentals/jobs/processQueue");
  const { buildDailyIndexJob } = await import("../lib/rentals/jobs/buildIndex");
  const { closeBrowser } = await import("../lib/rentals/playwright");

  const startTime = Date.now();

  console.log(`\n=== Rental Daily Scrape — ${new Date().toISOString().slice(0, 10)} ===\n`);

  const results: Record<string, { discovered: number; queued: number; processed: number; inserted: number; failed: number }> = {};

  for (const source of SOURCES) {
    console.log(`\n--- ${source} ---\n`);

    try {
      // Phase 1: Discover
      log("info", `[${source}] Discovering listings…`);
      const discResult = await discoverListingsJob(source, undefined, log, progress);
      log("info", `[${source}] Discovered ${discResult.discovered} URLs, queued ${discResult.queued}`);

      // Phase 2: Process queue
      log("info", `[${source}] Processing queue…`);
      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      let hasMore = true;
      const BATCH_SIZE = 50;
      const maxProcess = parseInt(process.env.RENTALS_MAX_PROCESS ?? "200", 10);

      while (hasMore && totalProcessed < maxProcess) {
        const batch = Math.min(BATCH_SIZE, maxProcess - totalProcessed);
        const procResult = await processQueueJob(source, { maxItems: batch }, log, progress);
        totalProcessed += procResult.processed;
        totalInserted += procResult.inserted;
        totalUpdated += procResult.updated;
        totalFailed += procResult.failed;
        if (procResult.processed < batch) hasMore = false;
      }

      log("info", `[${source}] Processed ${totalProcessed} (${totalInserted} new, ${totalUpdated} updated, ${totalFailed} failed)`);

      results[source] = {
        discovered: discResult.discovered,
        queued: discResult.queued,
        processed: totalProcessed,
        inserted: totalInserted,
        failed: totalFailed,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("error", `[${source}] FAILED: ${msg}`);
      results[source] = { discovered: 0, queued: 0, processed: 0, inserted: 0, failed: 1 };
    }
  }

  // Phase 3: Build index (once, covers all sources)
  console.log("\n--- Build Index ---\n");
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  log("info", `Building index for ${todayUTC.toISOString().slice(0, 10)}…`);
  await buildDailyIndexJob({ date: todayUTC }, log, progress);
  log("info", "Building index for yesterday…");
  await buildDailyIndexJob(undefined, log, progress);

  // Phase 4: Mark stale listings inactive (not seen in 7+ days)
  console.log("\n--- Mark Stale Listings ---\n");
  const { markStaleListingsJob } = await import("../lib/rentals/jobs/markStaleListings");
  const staleResult = await markStaleListingsJob(7, log);
  log("info", `Stale check: ${staleResult.deactivated} deactivated, ${staleResult.alreadyInactive} already inactive`);

  // Cleanup
  await closeBrowser();
  await prisma.$disconnect();

  // Summary
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log("\n=== Summary ===\n");
  for (const [src, r] of Object.entries(results)) {
    console.log(`  ${src}: ${r.discovered} found, ${r.queued} queued, ${r.processed} processed (${r.inserted} new, ${r.failed} failed)`);
  }
  console.log(`\n  Completed in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s\n`);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
