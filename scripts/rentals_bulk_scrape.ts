/**
 * Script: Bulk Scrape — local one-time full pipeline run
 *
 * Runs discover → process queue → build index with no caps, designed
 * to run locally on your machine where there's no Vercel timeout.
 * After the initial bulk load, daily incremental runs handle updates.
 *
 * Usage:
 *   npx tsx scripts/rentals_bulk_scrape.ts
 *   npx tsx scripts/rentals_bulk_scrape.ts --max-pages 100 --max-process 500
 *   npx tsx scripts/rentals_bulk_scrape.ts KHMER24
 *
 * Options:
 *   REALESTATE_KH | KHMER24  Run only one source (default: all enabled)
 *   --max-pages N     Max category pages to crawl (default: 9999 = all)
 *   --max-urls N      Max listing URLs to discover (default: 99999 = all)
 *   --max-process N   Max listings to scrape (default: 99999 = all)
 *   --skip-discover   Skip the discover phase (queue already populated)
 *   --skip-process    Skip the process phase (only discover + index)
 *   --skip-index      Skip the build-index phase
 *
 * Environment:
 *   Uses DATABASE_URL from .env / .env.local — point it at your prod DB
 *   to upload data directly, or use a local DB for testing first.
 */

/* ── CLI arg parsing (runs before imports) ───────────────── */

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}

const hasFlag = (name: string) => process.argv.includes(name);

const MAX_PAGES = getArg("--max-pages", 9999);
const MAX_URLS = getArg("--max-urls", 99999);
const MAX_PROCESS = getArg("--max-process", 99999);
const SKIP_DISCOVER = hasFlag("--skip-discover");
const SKIP_PROCESS = hasFlag("--skip-process");
const SKIP_INDEX = hasFlag("--skip-index");

/*
 * Override the config caps via env vars BEFORE importing job modules.
 * This lifts the normal per-run limits for bulk local operation.
 */
process.env.RENTALS_MAX_PAGES = String(MAX_PAGES);
process.env.RENTALS_MAX_URLS = String(MAX_URLS);
process.env.RENTALS_MAX_PROCESS = String(MAX_PROCESS);

/* ── Imports (safe — tsx evaluates top-level statements in order) ── */
/* eslint-disable @typescript-eslint/no-var-requires */

import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";
import type { RentalSource } from "@prisma/client";

/* ── Source selection ────────────────────────────────────── */
const VALID_SOURCES: RentalSource[] = [
  "REALESTATE_KH",
  "KHMER24",
  "IPS_CAMBODIA",
  "CAMREALTY",
  "LONGTERMLETTINGS",
  "FAZWAZ",
  "HOMETOGO",
];
const sourceArg = process.argv.find((a) => VALID_SOURCES.includes(a as RentalSource));
const SOURCES: RentalSource[] = sourceArg
  ? [sourceArg as RentalSource]
  : VALID_SOURCES; // run all enabled sources by default

/* ── Logger ──────────────────────────────────────────────── */

const log: PipelineLogFn = (level, message) => {
  const ts = new Date().toISOString().slice(11, 19);
  const tag = level.toUpperCase().padEnd(5);
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️ " : level === "debug" ? "  " : "▸ ";
  console.log(`${ts} ${tag} ${prefix}${message}`);
};

const progress: PipelineProgressFn = (p) => {
  const bar = "█".repeat(Math.round(p.percent / 5)) + "░".repeat(20 - Math.round(p.percent / 5));
  process.stdout.write(`\r  [${bar}] ${p.percent}% — ${p.label}  `);
  if (p.percent >= 100) process.stdout.write("\n");
};

/* ── Main ────────────────────────────────────────────────── */

async function main() {
  // Dynamic imports so env overrides are applied before config is read
  const { prisma } = await import("../lib/prisma");
  const { discoverListingsJob } = await import("../lib/rentals/jobs/discover");
  const { processQueueJob } = await import("../lib/rentals/jobs/processQueue");
  const { buildDailyIndexJob } = await import("../lib/rentals/jobs/buildIndex");
  const { closeBrowser } = await import("../lib/rentals/playwright");

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║    Rental Pipeline — Bulk Scrape         ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  Sources:      ${SOURCES.join(", ")}`);
  console.log(`  Max Pages:    ${MAX_PAGES}`);
  console.log(`  Max URLs:     ${MAX_URLS}`);
  console.log(`  Max Process:  ${MAX_PROCESS}`);
  console.log(`  Skip:         ${[SKIP_DISCOVER && "discover", SKIP_PROCESS && "process", SKIP_INDEX && "index"].filter(Boolean).join(", ") || "none"}`);
  console.log();

  const totalStart = Date.now();

  for (const SOURCE of SOURCES) {
    console.log(`\n╠══ Source: ${SOURCE} ${"═".repeat(30 - SOURCE.length)}╣\n`);

  /* ── Phase 1: Discover ─────────────────────────────────── */
  if (!SKIP_DISCOVER) {
    console.log("━━━ Phase 1/3: Discover Listings ━━━\n");
    const result = await discoverListingsJob(
      SOURCE,
      { maxUrls: MAX_URLS },
      log,
      progress
    );
    console.log(`\n  ✔ Discovered ${result.discovered} URLs, queued ${result.queued}, skipped ${result.skippedDuplicate} duplicates\n`);
  } else {
    console.log("━━━ Phase 1/3: Discover — SKIPPED ━━━\n");
  }

  /* ── Phase 2: Process Queue ────────────────────────────── */
  if (!SKIP_PROCESS) {
    console.log("━━━ Phase 2/3: Process Queue ━━━\n");

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let batchNum = 0;

    // Process in batches of 50 to keep memory manageable
    const BATCH_SIZE = 50;
    let hasMore = true;

    while (hasMore && totalProcessed < MAX_PROCESS) {
      batchNum++;
      const thisBatch = Math.min(BATCH_SIZE, MAX_PROCESS - totalProcessed);
      console.log(`  --- Batch ${batchNum} (up to ${thisBatch} listings) ---`);

      const result = await processQueueJob(
        SOURCE,
        { maxItems: thisBatch },
        log,
        progress
      );

      totalProcessed += result.processed;
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalFailed += result.failed;

      // If the batch processed fewer than requested, queue is drained
      if (result.processed < thisBatch) {
        hasMore = false;
      }

      console.log(`\n  Batch ${batchNum}: ${result.processed} processed (${result.inserted} new, ${result.updated} updated, ${result.failed} failed)`);
      console.log(`  Running total: ${totalProcessed} processed\n`);
    }

    console.log(`  ✔ Process complete — ${totalProcessed} total (${totalInserted} new, ${totalUpdated} updated, ${totalFailed} failed)\n`);
  } else {
    console.log("━━━ Phase 2/3: Process Queue — SKIPPED ━━━\n");
  }

  } // end for-each source

  /* ── Phase 3: Build Index ──────────────────────────────── */
  if (!SKIP_INDEX) {
    console.log("━━━ Phase 3/3: Build Daily Index ━━━\n");

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    log("info", `Building index for today (${todayUTC.toISOString().slice(0, 10)})…`);
    const todayResult = await buildDailyIndexJob({ date: todayUTC }, log, progress);
    console.log(`  Today: ${todayResult.indexRows} rows`);

    log("info", "Building index for yesterday…");
    const yesterdayResult = await buildDailyIndexJob(undefined, log, progress);
    console.log(`  Yesterday: ${yesterdayResult.indexRows} rows`);

    console.log(`\n  ✔ Index built — ${todayResult.indexRows + yesterdayResult.indexRows} total rows\n`);
  } else {
    console.log("━━━ Phase 3/3: Build Index — SKIPPED ━━━\n");
  }

  const totalMs = Date.now() - totalStart;
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.round((totalMs % 60000) / 1000);
  console.log(`\n✔ Bulk scrape finished in ${mins}m ${secs}s`);

  await closeBrowser();
  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
