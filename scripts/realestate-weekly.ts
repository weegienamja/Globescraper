/**
 * Script: Weekly full scrape — realestate.com.kh all listings
 *
 * Discovers ALL residential rental listings across 5 categories using
 * 40 overlapping query sets (date/price sorts × bedroom filters) to
 * beat the API's 5,000-per-query cap and reach ~35k listings.
 *
 * Re-enqueues stale listings (not seen in 7+ days) so their prices
 * get refreshed and any changes are captured as new snapshots.
 *
 * Designed to run weekly. Takes 2-6 hours depending on connection.
 *
 * Usage:
 *   npx tsx scripts/realestate-weekly.ts
 *   npx tsx scripts/realestate-weekly.ts --rescrape-days 5
 *   npx tsx scripts/realestate-weekly.ts --max-process 5000
 *   npx tsx scripts/realestate-weekly.ts --concurrency 3
 *   npx tsx scripts/realestate-weekly.ts --batch-cooldown 10000
 *   npx tsx scripts/realestate-weekly.ts --discover-only
 *   npx tsx scripts/realestate-weekly.ts --process-only
 *   npx tsx scripts/realestate-weekly.ts --workers 3
 */

/* ── CLI args ────────────────────────────────────────────── */

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}
const hasFlag = (name: string) => process.argv.includes(name);

const MAX_PROCESS = getArg("--max-process", 99999);
const BATCH_SIZE = getArg("--batch-size", 200);
const RESCRAPE_DAYS = getArg("--rescrape-days", 7);
const CONCURRENCY = getArg("--concurrency", 1);
const WORKERS = getArg("--workers", 1);
const DISCOVER_ONLY = hasFlag("--discover-only");
const PROCESS_ONLY = hasFlag("--process-only");
const IS_WORKER = hasFlag("--_worker");

/** Cooling period between batches (ms) — gives DB + target site breathing room. */
const BATCH_COOLDOWN_MS = getArg("--batch-cooldown", 15_000);

/** Max consecutive batch failures before aborting. */
const MAX_CONSECUTIVE_FAILURES = 5;

// Lift pipeline caps
process.env.RENTALS_MAX_PROCESS = String(BATCH_SIZE);
process.env.RENTALS_CONCURRENCY = String(CONCURRENCY);

/* ── Imports ─────────────────────────────────────────────── */

import { prisma } from "../lib/prisma";
import { QueueStatus, RentalSource } from "@prisma/client";
import { canonicalizeUrl } from "../lib/rentals/url";
import { processQueueJob } from "../lib/rentals/jobs/processQueue";
import { buildDailyIndexJob } from "../lib/rentals/jobs/buildIndex";
import { markStaleListingsJob } from "../lib/rentals/jobs/markStaleListings";
import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";
import { USER_AGENT } from "../lib/rentals/config";
import { nightIdleDelay, maybeBreather } from "../lib/rentals/http";
import { ProxyAgent } from "undici";
import { execFile } from "child_process";
import path from "path";

/* ── Proxy ────────────────────────────────────────────────── */

const PROXY_URL = process.env.SCRAPE_PROXY || "";
let proxyDispatcher: ProxyAgent | undefined;

if (PROXY_URL) {
  proxyDispatcher = new ProxyAgent(PROXY_URL);
  console.log(`\n🌏 Proxy enabled: ${PROXY_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
}

/* ── Constants ───────────────────────────────────────────── */

const SOURCE: RentalSource = "REALESTATE_KH";
const API_BASE = "https://www.realestate.com.kh/api/portal/pages/results/";
const API_PAGE_SIZE = 100;
const API_MAX_PAGE = 50;
const ORIGIN = "https://www.realestate.com.kh";

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

const CATEGORIES = [
  { pathname: "/rent/apartment/", label: "apartment" },
  { pathname: "/rent/serviced-apartment/", label: "serviced-apartment" },
  { pathname: "/rent/penthouse/", label: "penthouse" },
  { pathname: "/rent/house/", label: "house" },
  { pathname: "/rent/villa/", label: "villa" },
];

/* ── Logger ──────────────────────────────────────────────── */

const log: PipelineLogFn = (level, message) => {
  const ts = new Date().toISOString().slice(11, 19);
  const tag = level.toUpperCase().padEnd(5);
  const prefix =
    level === "error" ? "❌ " : level === "warn" ? "⚠️  " : level === "debug" ? "   " : "▸  ";
  console.log(`${ts} ${tag} ${prefix}${message}`);
};

const progress: PipelineProgressFn = (p) => {
  const bar = "█".repeat(Math.round(p.percent / 5)) + "░".repeat(20 - Math.round(p.percent / 5));
  process.stdout.write(`\r  [${bar}] ${p.percent}% — ${p.label}  `);
  if (p.percent >= 100) process.stdout.write("\n");
};

/* ── API types + fetch ───────────────────────────────────── */

interface ApiResult {
  id: number;
  url: string;
  headline: string;
  nested?: ApiResult[];
}

interface ApiResponse {
  count: number;
  last_page: number;
  results: ApiResult[];
}

async function fetchApiPage(params: {
  pathname: string;
  page: number;
  order_by?: string;
  bedrooms?: number;
}): Promise<ApiResponse | null> {
  const qs = new URLSearchParams({
    pathname: params.pathname,
    page_size: String(API_PAGE_SIZE),
    page: String(params.page),
    search_languages: "en",
  });
  if (params.order_by) qs.set("order_by", params.order_by);
  if (params.bedrooms !== undefined) qs.set("bedrooms", String(params.bedrooms));

  const url = `${API_BASE}?${qs}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const resp = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Accept-Language": "en",
          "Accept-Currency": "usd",
        },
        signal: controller.signal,
        // @ts-expect-error — undici dispatcher is valid at runtime but not in DOM fetch types
        dispatcher: proxyDispatcher,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 400) return null;
        if (resp.status === 429 || resp.status >= 500) {
          const backoff = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
          log("warn", `API ${resp.status}, retry in ${Math.round(backoff)}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        return null;
      }
      return (await resp.json()) as ApiResponse;
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
        continue;
      }
      log("error", `API fetch failed: ${url}`);
      return null;
    }
  }
  return null;
}

function apiDelay(): Promise<void> {
  // Base: 1.5–3s, with ~10% chance of a longer 6–12s pause
  let ms = 1500 + Math.random() * 1500;
  if (Math.random() < 0.10) {
    ms += 4500 + Math.random() * 6000;
  }
  return new Promise((r) => setTimeout(r, ms));
}

/* ── Helpers ─────────────────────────────────────────────── */

interface DiscoveredUrl {
  url: string;
  sourceListingId: string | null;
}

function extractListingId(url: string): string | null {
  const match = url.match(/-(\d{5,})\/?(?:[?#]|$)/);
  return match ? match[1] : null;
}

function extractUrlsFromApiResponse(
  response: ApiResponse,
  seen: Set<string>,
  out: DiscoveredUrl[]
): number {
  let added = 0;
  for (const result of response.results) {
    // Main listing
    if (result.url) {
      const fullUrl = result.url.startsWith("http") ? result.url : `${ORIGIN}${result.url}`;
      const listingId = extractListingId(fullUrl);
      if (listingId) {
        const canonical = canonicalizeUrl(fullUrl);
        if (!seen.has(canonical)) {
          seen.add(canonical);
          out.push({ url: canonical, sourceListingId: listingId });
          added++;
        }
      }
    }
    // Nested sub-listings
    if (result.nested && Array.isArray(result.nested)) {
      for (const nested of result.nested) {
        if (nested.url) {
          const fullUrl = nested.url.startsWith("http") ? nested.url : `${ORIGIN}${nested.url}`;
          const listingId = extractListingId(fullUrl);
          if (listingId) {
            const canonical = canonicalizeUrl(fullUrl);
            if (!seen.has(canonical)) {
              seen.add(canonical);
              out.push({ url: canonical, sourceListingId: listingId });
              added++;
            }
          }
        }
      }
    }
  }
  return added;
}

/* ── Query plan ──────────────────────────────────────────── */

interface ApiQuery {
  pathname: string;
  order_by: string;
  bedrooms?: number;
  label: string;
}

function buildQueryPlan(): ApiQuery[] {
  const queries: ApiQuery[] = [];

  for (const cat of CATEGORIES) {
    queries.push({ pathname: cat.pathname, order_by: "date-desc", label: `${cat.label}` });
    queries.push({ pathname: cat.pathname, order_by: "date-asc", label: `${cat.label}/asc` });
  }

  for (const big of ["/rent/apartment/", "/rent/house/"]) {
    const label = big.includes("apartment") ? "apartment" : "house";
    queries.push({ pathname: big, order_by: "price-asc", label: `${label}/price-asc` });
    queries.push({ pathname: big, order_by: "price-desc", label: `${label}/price-desc` });
  }

  for (const big of ["/rent/apartment/", "/rent/house/"]) {
    const label = big.includes("apartment") ? "apartment" : "house";
    for (let bed = 0; bed <= 10; bed++) {
      queries.push({ pathname: big, bedrooms: bed, order_by: "date-desc", label: `${label}/bed=${bed}` });
    }
  }

  for (const extra of ["date-asc", "price-asc", "price-desc"] as const) {
    queries.push({ pathname: "/rent/apartment/", bedrooms: 1, order_by: extra, label: `apartment/bed=1/${extra}` });
  }
  queries.push({ pathname: "/rent/apartment/", bedrooms: 2, order_by: "date-asc", label: "apartment/bed=2/asc" });

  return queries;
}

/* ── Phase 1: Discover ───────────────────────────────────── */

async function discoverAll(): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  let totalApiCalls = 0;
  const queries = buildQueryPlan();

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 1 — Full discovery via API             ║");
  console.log(`║  Queries: ${String(queries.length).padEnd(3)} query sets                    ║`);
  console.log(`║  Max per query: ${API_PAGE_SIZE} × ${API_MAX_PAGE} = 5,000 results   ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];
    const qLabel = `${q.label} [${q.order_by}]`;

    const firstPage = await fetchApiPage({
      pathname: q.pathname,
      page: 1,
      order_by: q.order_by,
      bedrooms: q.bedrooms,
    });
    totalApiCalls++;

    if (!firstPage || firstPage.results.length === 0) {
      log("debug", `[${qi + 1}/${queries.length}] ${qLabel}: empty, skipping`);
      await apiDelay();
      continue;
    }

    const totalInSlice = firstPage.count;
    const maxPages = Math.min(API_MAX_PAGE, Math.ceil(totalInSlice / API_PAGE_SIZE));
    const beforeCount = urls.length;
    const added = extractUrlsFromApiResponse(firstPage, seen, urls);

    log("info", `[${qi + 1}/${queries.length}] ${qLabel}: ${totalInSlice} total, ${maxPages} pages — +${added} new (${urls.length} total)`);

    for (let page = 2; page <= maxPages; page++) {
      await apiDelay();
      const resp = await fetchApiPage({
        pathname: q.pathname,
        page,
        order_by: q.order_by,
        bedrooms: q.bedrooms,
      });
      totalApiCalls++;

      if (!resp || resp.results.length === 0) break;

      const pageAdded = extractUrlsFromApiResponse(resp, seen, urls);
      if (page % 10 === 0 || page === maxPages) {
        log("info", `  page ${page}/${maxPages}: +${pageAdded} new (${urls.length} total)`);
      }
    }

    const queryTotal = urls.length - beforeCount;
    log("info", `  → query added ${queryTotal} new URLs (total: ${urls.length})`);

    // Night-time idle + occasional breather between query sets
    await nightIdleDelay();
    await maybeBreather((msg) => log("info", msg));
  }

  log("info", `\nDiscovery complete: ${urls.length} unique listing URLs from ${totalApiCalls} API calls`);
  return urls;
}

/* ── Phase 2: Enqueue (new + stale) ──────────────────────── */

async function enqueueNewUrls(discovered: DiscoveredUrl[]): Promise<{ newCount: number; rescrapeCount: number }> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 2 — Enqueue new + stale listings       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const existingRows = await prisma.rentalListing.findMany({
    where: { source: SOURCE },
    select: { canonicalUrl: true, lastSeenAt: true },
  });
  const existingMap = new Map(existingRows.map((r) => [r.canonicalUrl, r.lastSeenAt]));
  log("info", `${existingMap.size} existing listings in DB`);

  const queuedRows = await prisma.scrapeQueue.findMany({
    where: {
      source: SOURCE,
      status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
    },
    select: { canonicalUrl: true },
  });
  const queuedUrls = new Set(queuedRows.map((r) => r.canonicalUrl));
  log("info", `${queuedUrls.size} already pending in queue`);

  const staleCutoff = new Date(Date.now() - RESCRAPE_DAYS * 24 * 60 * 60 * 1000);
  log("info", `Re-scrape threshold: ${RESCRAPE_DAYS} days (stale if lastSeenAt < ${staleCutoff.toISOString().slice(0, 10)})`);

  const brandNew: DiscoveredUrl[] = [];
  const stale: DiscoveredUrl[] = [];

  for (const d of discovered) {
    if (queuedUrls.has(d.url)) continue;
    const lastSeen = existingMap.get(d.url);
    if (!lastSeen) {
      brandNew.push(d);
    } else if (lastSeen < staleCutoff) {
      stale.push(d);
    }
  }

  log("info", `${brandNew.length} brand new URLs to enqueue`);
  log("info", `${stale.length} stale URLs to re-scrape`);

  const toEnqueue = [...brandNew, ...stale];
  if (toEnqueue.length === 0) return { newCount: 0, rescrapeCount: 0 };

  let queued = 0;
  const UPSERT_BATCH = 50;
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
    if (queued % 500 === 0 || i + UPSERT_BATCH >= toEnqueue.length) {
      log("info", `Enqueued ${queued}/${toEnqueue.length}`);
    }
  }

  return { newCount: brandNew.length, rescrapeCount: stale.length };
}

/* ── Spawn parallel workers ───────────────────────────────── */

function spawnWorkers(n: number): Promise<void> {
  console.log(`\nSpawning ${n} workers for parallel processing...\n`);
  const script = path.resolve(__dirname, "realestate-weekly.ts");

  const workers = Array.from({ length: n }, (_, i) => {
    return new Promise<void>((resolve, reject) => {
      const args = [
        "tsx",
        script,
        "--process-only",
        "--_worker",
        "--concurrency",
        String(CONCURRENCY),
        "--batch-size",
        String(BATCH_SIZE),
        "--max-process",
        String(Math.ceil(MAX_PROCESS / n)),
        "--batch-cooldown",
        String(BATCH_COOLDOWN_MS),
        "--rescrape-days",
        String(RESCRAPE_DAYS),
      ];

      console.log(`[worker-${i}] starting`);
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
    if (failed.length) {
      console.warn(`${failed.length}/${n} workers failed`);
    }
    console.log("All workers finished.\n");
  });
}

/* ── Phase 3: Process queue ──────────────────────────────── */

async function processAllBatches(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 3 — Process queue (scrape listings)   ║");
  console.log(`║  Concurrency: ${CONCURRENCY}  Batch: ${BATCH_SIZE}  Cooldown: ${BATCH_COOLDOWN_MS}ms  ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let batchNum = 0;
  let consecutiveFailures = 0;

  while (totalProcessed < MAX_PROCESS) {
    // ── Graceful shutdown check ──
    if (shutdownRequested) {
      log("warn", "Shutdown requested — stopping after current batch");
      break;
    }

    let pendingCount: number;
    try {
      pendingCount = await prisma.scrapeQueue.count({
        where: {
          source: SOURCE,
          status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
        },
      });
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      log("error", `DB error counting pending items: ${msg}`);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log("error", `${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`);
        break;
      }
      const backoff = Math.min(consecutiveFailures * 10_000, 60_000);
      log("warn", `Waiting ${backoff / 1000}s before retry…`);
      await new Promise((r) => setTimeout(r, backoff));
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

      log("info", `Batch ${batchNum} done — cumulative: ${totalProcessed} processed, ${totalInserted} inserted, ${totalUpdated} updated, ${totalFailed} failed`);

      if (result.processed === 0) break;

      // Reset failure counter on success
      consecutiveFailures = 0;
    } catch (batchErr) {
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      log("error", `Batch ${batchNum} crashed: ${msg}`);
      consecutiveFailures++;

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log("error", `${MAX_CONSECUTIVE_FAILURES} consecutive batch failures — aborting run`);
        break;
      }

      // Exponential backoff: 10s, 20s, 30s, 40s…
      const backoff = Math.min(consecutiveFailures * 10_000, 60_000);
      log("warn", `Will retry in ${backoff / 1000}s (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})…`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    // ── Cooling period between batches ──
    if (totalProcessed < MAX_PROCESS && !shutdownRequested) {
      log("debug", `Cooling ${BATCH_COOLDOWN_MS / 1000}s before next batch…`);
      await new Promise((r) => setTimeout(r, BATCH_COOLDOWN_MS));
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

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  realestate.com.kh — Weekly Full Scrape               ║");
  console.log("║  All categories • 40 query sets • Re-scrape stale     ║");
  console.log(`║  Concurrency: ${CONCURRENCY}  Batch: ${BATCH_SIZE}  Cooldown: ${BATCH_COOLDOWN_MS / 1000}s`);
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const start = Date.now();

  if (!PROCESS_ONLY) {
    const discovered = await discoverAll();

    if (discovered.length > 0) {
      const { newCount, rescrapeCount } = await enqueueNewUrls(discovered);
      log("info", `Enqueued ${newCount} new + ${rescrapeCount} stale listings`);
    }

    if (DISCOVER_ONLY) {
      log("info", "Discover-only mode — skipping process phase.");
      await prisma.$disconnect();
      return;
    }
  }

  // If --workers > 1 and this is the main process, spawn children
  if (WORKERS > 1 && !IS_WORKER) {
    await spawnWorkers(WORKERS);
  } else {
    await processAllBatches();
  }

  // Phase 4: Rebuild daily index
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Rebuilding daily index                       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await buildDailyIndexJob({ date: todayUTC }, log, progress);

  // Phase 5: Mark stale listings inactive
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Marking stale listings inactive              ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const staleResult = await markStaleListingsJob(14, log);
  log("info", `${staleResult.deactivated} deactivated, ${staleResult.alreadyInactive} already inactive`);

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  log("info", `\n✔ Weekly scrape completed in ${elapsed} minutes`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
