/**
 * Script: Khmer24 bulk scrape — multi-worker, proxy-aware
 *
 * Discovers listing URLs from Khmer24 category pages (using Playwright
 * to bypass Cloudflare), enqueues them, then processes the queue in
 * batches. Supports multiple parallel workers and proxy rotation.
 *
 * Usage:
 *   # Basic: discover + process
 *   npx tsx scripts/khmer24-scrape.ts
 *
 *   # More pages, more listings
 *   npx tsx scripts/khmer24-scrape.ts --max-pages 100 --max-urls 5000
 *
 *   # Process-only (skip discover — queue already populated)
 *   npx tsx scripts/khmer24-scrape.ts --process-only
 *
 *   # Discover-only (just fill the queue, don't scrape yet)
 *   npx tsx scripts/khmer24-scrape.ts --discover-only
 *
 *   # With a proxy
 *   npx tsx scripts/khmer24-scrape.ts --proxy http://user:pass@host:port
 *   SCRAPE_PROXY=socks5://host:port npx tsx scripts/khmer24-scrape.ts
 *
 *   # Spawn 3 parallel workers (each gets its own browser)
 *   npx tsx scripts/khmer24-scrape.ts --workers 3
 *
 *   # Fast mode: reduce wait times (riskier for CF detection)
 *   npx tsx scripts/khmer24-scrape.ts --fast
 *
 *   # Re-scrape listings not seen in N days
 *   npx tsx scripts/khmer24-scrape.ts --rescrape-days 5
 *
 *   # Combine: discover with proxy, then spawn 3 workers to process
 *   npx tsx scripts/khmer24-scrape.ts --proxy http://p1:3128 --workers 3 --max-pages 50
 */

/* ── CLI args ────────────────────────────────────────────── */

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}
function getStrArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}
const hasFlag = (name: string) => process.argv.includes(name);

const MAX_PAGES     = getArg("--max-pages", 30);
const MAX_URLS      = getArg("--max-urls", 2000);
const MAX_PROCESS   = getArg("--max-process", 99999);
const BATCH_SIZE    = getArg("--batch-size", 20);
const RESCRAPE_DAYS = getArg("--rescrape-days", 7);
const WORKERS       = getArg("--workers", 1);
const COOLDOWN_MS   = getArg("--batch-cooldown", 5000);
const DISCOVER_ONLY = hasFlag("--discover-only");
const PROCESS_ONLY  = hasFlag("--process-only");
const IS_WORKER     = hasFlag("--_worker");
const FAST_MODE     = hasFlag("--fast");
const PROXY_URL     = getStrArg("--proxy") || process.env.SCRAPE_PROXY || "";
const WORKER_ID     = getStrArg("--_worker-id") || "0";

// Lift pipeline caps
process.env.RENTALS_MAX_PAGES   = String(MAX_PAGES);
process.env.RENTALS_MAX_URLS    = String(MAX_URLS);
process.env.RENTALS_MAX_PROCESS = String(BATCH_SIZE);
process.env.RENTALS_CONCURRENCY = "1"; // Playwright is sequential per browser

// Fast mode: shorter waits
if (FAST_MODE) {
  process.env.PW_WAIT_MS = "2500";
}

/* ── Imports ─────────────────────────────────────────────── */

import { prisma } from "../lib/prisma";
import { QueueStatus, RentalSource } from "@prisma/client";
import { canonicalizeUrl } from "../lib/rentals/url";
import { processQueueJob } from "../lib/rentals/jobs/processQueue";
import { buildDailyIndexJob } from "../lib/rentals/jobs/buildIndex";
import { markStaleListingsJob } from "../lib/rentals/jobs/markStaleListings";
import { discoverKhmer24 } from "../lib/rentals/sources/khmer24";
import { configureProxy, closeBrowser } from "../lib/rentals/playwright";
import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";
import { execFile } from "child_process";
import path from "path";

/* ── Constants ───────────────────────────────────────────── */

const SOURCE: RentalSource = "KHMER24";

/* ── Graceful shutdown ───────────────────────────────────── */

let shutdownRequested = false;

function setupGracefulShutdown() {
  const handler = (signal: string) => {
    if (shutdownRequested) {
      console.log(`\n⚠️  Second ${signal} — forcing exit`);
      process.exit(1);
    }
    shutdownRequested = true;
    console.log(`\n⚠️  ${signal} received — finishing current batch then exiting gracefully…`);
  };
  process.on("SIGINT", () => handler("SIGINT"));
  process.on("SIGTERM", () => handler("SIGTERM"));
}

/* ── Logger ──────────────────────────────────────────────── */

const log: PipelineLogFn = (level, message) => {
  const ts = new Date().toISOString().slice(11, 19);
  const tag = level.toUpperCase().padEnd(5);
  const prefix =
    level === "error" ? "❌ " : level === "warn" ? "⚠️  " : level === "debug" ? "   " : "▸  ";
  const wTag = IS_WORKER ? `[w${WORKER_ID}] ` : "";
  console.log(`${ts} ${tag} ${wTag}${prefix}${message}`);
};

const progress: PipelineProgressFn = (p) => {
  const bar = "█".repeat(Math.round(p.percent / 5)) + "░".repeat(20 - Math.round(p.percent / 5));
  process.stdout.write(`\r  [${bar}] ${p.percent}% — ${p.label}  `);
  if (p.percent >= 100) process.stdout.write("\n");
};

/* ── Phase 1: Discover ───────────────────────────────────── */

async function discover(): Promise<number> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 1 — Discover Khmer24 listings          ║");
  console.log(`║  Max pages: ${String(MAX_PAGES).padEnd(4)} Max URLs: ${String(MAX_URLS).padEnd(6)}         ║`);
  if (PROXY_URL) {
    console.log(`║  Proxy: ${PROXY_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@").slice(0, 38).padEnd(38)}║`);
  }
  console.log("╚══════════════════════════════════════════════╝\n");

  let discovered: Awaited<ReturnType<typeof discoverKhmer24>>;
  try {
    discovered = await discoverKhmer24(log);
  } catch (err) {
    if (shutdownRequested) {
      log("warn", "Discover interrupted by shutdown — using partial results");
      return 0;
    }
    throw err;
  }
  log("info", `Discovered ${discovered.length} listing URLs`);

  if (discovered.length === 0) return 0;

  // Check which are new vs already in DB
  const existingRows = await prisma.rentalListing.findMany({
    where: { source: SOURCE },
    select: { canonicalUrl: true, lastSeenAt: true },
  });
  const existingMap = new Map(existingRows.map((r) => [r.canonicalUrl, r.lastSeenAt]));

  const queuedRows = await prisma.scrapeQueue.findMany({
    where: { source: SOURCE, status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] } },
    select: { canonicalUrl: true },
  });
  const queuedUrls = new Set(queuedRows.map((r) => r.canonicalUrl));

  const staleCutoff = new Date(Date.now() - RESCRAPE_DAYS * 24 * 60 * 60 * 1000);
  const brandNew: typeof discovered = [];
  const stale: typeof discovered = [];

  for (const d of discovered) {
    if (queuedUrls.has(d.url)) continue;
    const lastSeen = existingMap.get(d.url);
    if (!lastSeen) {
      brandNew.push(d);
    } else if (lastSeen < staleCutoff) {
      stale.push(d);
    }
  }

  const toEnqueue = [...brandNew, ...stale];
  log("info", `${brandNew.length} brand new + ${stale.length} stale = ${toEnqueue.length} to enqueue`);

  if (toEnqueue.length === 0) return 0;

  // Batch upsert into queue
  const UPSERT_BATCH = 50;
  let queued = 0;
  for (let i = 0; i < toEnqueue.length; i += UPSERT_BATCH) {
    const batch = toEnqueue.slice(i, i + UPSERT_BATCH);
    await Promise.all(
      batch.map((item) =>
        prisma.scrapeQueue.upsert({
          where: { source_canonicalUrl: { source: SOURCE, canonicalUrl: item.url } },
          create: {
            source: SOURCE,
            canonicalUrl: item.url,
            sourceListingId: item.sourceListingId,
            status: QueueStatus.PENDING,
            priority: 0,
          },
          update: {
            status: QueueStatus.PENDING,
            attempts: 0,
            lastError: null,
            updatedAt: new Date(),
          },
        })
      )
    );
    queued += batch.length;
  }

  log("info", `Enqueued ${queued} listings into scrape queue`);
  return queued;
}

/* ── Spawn parallel workers ───────────────────────────────── */

function spawnWorkers(n: number, proxies: string[]): Promise<void> {
  console.log(`\nSpawning ${n} workers for parallel processing…\n`);
  const script = path.resolve(__dirname, "khmer24-scrape.ts");

  const workers = Array.from({ length: n }, (_, i) => {
    return new Promise<void>((resolve, reject) => {
      const workerProxy = proxies.length > 0
        ? proxies[i % proxies.length]
        : PROXY_URL;

      const args = [
        "tsx", script,
        "--process-only",
        "--_worker",
        "--_worker-id", String(i),
        "--batch-size", String(BATCH_SIZE),
        "--max-process", String(Math.ceil(MAX_PROCESS / n)),
        "--batch-cooldown", String(COOLDOWN_MS),
      ];

      if (workerProxy) args.push("--proxy", workerProxy);
      if (FAST_MODE) args.push("--fast");

      console.log(`[worker-${i}] starting${workerProxy ? ` (proxy: ${workerProxy.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")})` : ""}`);
      const child = execFile("npx", args, { maxBuffer: 50 * 1024 * 1024, shell: true });

      child.stdout?.on("data", (d: Buffer) =>
        process.stdout.write(`[w${i}] ${d}`)
      );
      child.stderr?.on("data", (d: Buffer) =>
        process.stderr.write(`[w${i}] ${d}`)
      );

      child.on("close", (code) => {
        console.log(`[worker-${i}] exited with code ${code}`);
        code === 0 ? resolve() : reject(new Error(`Worker ${i} exited ${code}`));
      });
      child.on("error", reject);
    });
  });

  return Promise.allSettled(workers).then((results) => {
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) console.warn(`${failed.length}/${n} workers failed`);
    console.log("All workers finished.\n");
  });
}

/* ── Phase 2: Process queue ──────────────────────────────── */

async function processAllBatches(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 2 — Process queue (scrape listings)    ║");
  console.log(`║  Batch: ${BATCH_SIZE}  Cooldown: ${COOLDOWN_MS / 1000}s${FAST_MODE ? "  ⚡ FAST MODE" : ""}          ║`);
  if (PROXY_URL) {
    console.log(`║  Proxy: ${PROXY_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@").slice(0, 38).padEnd(38)}║`);
  }
  console.log("╚══════════════════════════════════════════════╝\n");

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let batchNum = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;

  while (totalProcessed < MAX_PROCESS) {
    if (shutdownRequested) {
      log("warn", "Shutdown requested — stopping after current batch");
      break;
    }

    let pendingCount: number;
    try {
      pendingCount = await prisma.scrapeQueue.count({
        where: { source: SOURCE, status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] } },
      });
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      log("error", `DB error: ${msg}`);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log("error", `${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`);
        break;
      }
      await new Promise((r) => setTimeout(r, consecutiveFailures * 10_000));
      continue;
    }

    if (pendingCount === 0) {
      log("info", "Queue empty — all done!");
      break;
    }

    batchNum++;
    const batchMax = Math.min(BATCH_SIZE, MAX_PROCESS - totalProcessed);
    log("info", `\n── Batch ${batchNum}: processing up to ${batchMax} (${pendingCount} pending) ──`);

    try {
      const result = await processQueueJob(SOURCE, { maxItems: batchMax }, log, progress);

      totalProcessed += result.processed;
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalFailed += result.failed;

      log("info", `Batch ${batchNum} done — cumulative: ${totalProcessed} processed, ${totalInserted} new, ${totalUpdated} updated, ${totalFailed} failed`);

      if (result.processed === 0) break;
      consecutiveFailures = 0;
    } catch (batchErr) {
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      log("error", `Batch ${batchNum} crashed: ${msg}`);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log("error", `${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`);
        break;
      }
      const backoff = Math.min(consecutiveFailures * 10_000, 60_000);
      log("warn", `Retrying in ${backoff / 1000}s…`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    // Cooling period
    if (totalProcessed < MAX_PROCESS && !shutdownRequested) {
      log("debug", `Cooling ${COOLDOWN_MS / 1000}s…`);
      await new Promise((r) => setTimeout(r, COOLDOWN_MS));
    }
  }

  console.log("\n┌────────────────────────────────────────┐");
  console.log(`│  Total processed: ${String(totalProcessed).padStart(6)}`);
  console.log(`│  Total inserted:  ${String(totalInserted).padStart(6)}`);
  console.log(`│  Total updated:   ${String(totalUpdated).padStart(6)}`);
  console.log(`│  Total failed:    ${String(totalFailed).padStart(6)}`);
  console.log("└────────────────────────────────────────┘");
}

/* ── Main ────────────────────────────────────────────────── */

async function main() {
  setupGracefulShutdown();

  // Configure proxy for Playwright
  if (PROXY_URL) {
    configureProxy(PROXY_URL);
    log("info", `Proxy configured: ${PROXY_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  Khmer24 — Bulk Scrape                                ║");
  console.log(`║  Pages: ${String(MAX_PAGES).padEnd(4)} URLs: ${String(MAX_URLS).padEnd(5)} Batch: ${String(BATCH_SIZE).padEnd(3)} Workers: ${WORKERS}     ║`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const start = Date.now();

  // Phase 1: Discover
  if (!PROCESS_ONLY) {
    await discover();

    if (DISCOVER_ONLY) {
      log("info", "Discover-only mode — done.");
      await closeBrowser();
      await prisma.$disconnect();
      return;
    }

    // Close the discover browser so workers can create their own
    await closeBrowser();
  }

  // Phase 2: Process
  if (WORKERS > 1 && !IS_WORKER) {
    // Read proxy list from file if it exists, else use single proxy
    let proxies: string[] = [];
    try {
      const fs = await import("fs");
      const proxyFile = path.resolve(__dirname, "proxies.txt");
      if (fs.existsSync(proxyFile)) {
        proxies = fs.readFileSync(proxyFile, "utf-8")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));
        log("info", `Loaded ${proxies.length} proxies from proxies.txt`);
      }
    } catch { /* no proxy file, that's fine */ }

    await spawnWorkers(WORKERS, proxies);
  } else {
    await processAllBatches();
  }

  // Phase 3: Build index (only from main process)
  if (!IS_WORKER) {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║  Rebuilding daily index                       ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await buildDailyIndexJob({ date: todayUTC }, log, progress);

    // Phase 4: Mark stale
    const staleResult = await markStaleListingsJob(14, log);
    log("info", `${staleResult.deactivated} deactivated, ${staleResult.alreadyInactive} already inactive`);
  }

  await closeBrowser();
  await prisma.$disconnect();

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  log("info", `\n✔ Khmer24 scrape completed in ${elapsed} minutes`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
