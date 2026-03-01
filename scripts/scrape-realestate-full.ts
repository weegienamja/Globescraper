/**
 * Script: Full realestate.com.kh scrape
 *
 * Uses the internal JSON API at /api/portal/pages/results/ to discover
 * all residential rental listings on realestate.com.kh/rent/.
 * The site is a Next.js SPA so HTML pagination doesn't work — the API
 * is the only reliable way to paginate.
 *
 * API constraints:
 *   page_size capped at 100, last_page capped at 50 → max 5,000 results per query.
 *   To reach all ~34k listings we use multiple query strategies:
 *   1. Per-category crawl with date-desc + date-asc sort (covers sets ≤ 10k fully)
 *   2. Bedroom-filtered queries for large categories (apartment, house)
 *   3. Extra sort orders (price-asc/desc) for slices > 10k
 *
 * Discovers listing URLs, skips already-scraped ones, enqueues new ones,
 * and processes the queue through the existing pipeline.
 *
 * Usage:
 *   npx tsx scripts/scrape-realestate-full.ts
 *   npx tsx scripts/scrape-realestate-full.ts --discover-only
 *   npx tsx scripts/scrape-realestate-full.ts --process-only
 *   npx tsx scripts/scrape-realestate-full.ts --max-process 500
 *   npx tsx scripts/scrape-realestate-full.ts --batch-size 100
 *   npx tsx scripts/scrape-realestate-full.ts --rescrape-days 3
 *   npx tsx scripts/scrape-realestate-full.ts --workers 3
 *
 * The --workers flag spawns N parallel child processes.
 * Each worker atomically claims items from the queue via SQL UPDATE…LIMIT,
 * so no two workers process the same listing.
 */

/* ── CLI args ────────────────────────────────────────────── */

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}
const hasFlag = (name: string) => process.argv.includes(name);

const MAX_PROCESS = getArg("--max-process", 99999);
const BATCH_SIZE = getArg("--batch-size", 200); // queue items per process batch
const RESCRAPE_DAYS = getArg("--rescrape-days", 7); // re-scrape listings older than N days
const WORKERS = getArg("--workers", 1); // parallel worker processes for scraping
const DISCOVER_ONLY = hasFlag("--discover-only");
const PROCESS_ONLY = hasFlag("--process-only");
const IS_WORKER = hasFlag("--_worker"); // internal flag — true when spawned as child

// Lift pipeline caps so processQueueJob doesn't limit itself
process.env.RENTALS_MAX_PROCESS = String(BATCH_SIZE);

/* ── Imports ─────────────────────────────────────────────── */

import { prisma } from "../lib/prisma";
import { QueueStatus, RentalSource } from "@prisma/client";
import { canonicalizeUrl } from "../lib/rentals/url";
import { processQueueJob } from "../lib/rentals/jobs/processQueue";
import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";
import { USER_AGENT } from "../lib/rentals/config";

/* ── Constants ───────────────────────────────────────────── */

const SOURCE: RentalSource = "REALESTATE_KH";
const API_BASE = "https://www.realestate.com.kh/api/portal/pages/results/";
const API_PAGE_SIZE = 100; // server-side max
const API_MAX_PAGE = 50;   // server-side cap on `last_page`
const ORIGIN = "https://www.realestate.com.kh";

/**
 * Category API pathnames for residential property types.
 * - /rent/condo/ is identical to /rent/apartment/ (same 25.5k result set)
 * - /rent/townhouse/ is invalid in the API (townhouses included in /rent/house/)
 */
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

/* ── API fetch helper ────────────────────────────────────── */

interface ApiResult {
  id: number;
  url: string; // relative, e.g. "/rent/bkk-1/3-bed-4-bath-apartment-259490/"
  headline: string;
  nested?: ApiResult[];
}

interface ApiResponse {
  count: number;
  last_page: number;
  results: ApiResult[];
}

/**
 * Fetch one page from the realestate.com.kh listing API.
 * Returns null on error (including "Invalid page" for beyond-data pages).
 */
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
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        // "Invalid page" → beyond available data, not an error
        if (resp.status === 404 || resp.status === 400) return null;
        if (resp.status === 429 || resp.status >= 500) {
          const backoff = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
          log("warn", `API ${resp.status} for ${url}, retry in ${Math.round(backoff)}ms`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        return null;
      }

      return (await resp.json()) as ApiResponse;
    } catch (err) {
      if (attempt < 2) {
        const backoff = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        log("warn", `API fetch error, retry in ${Math.round(backoff)}ms: ${err}`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      log("error", `API fetch failed permanently: ${url}`);
      return null;
    }
  }
  return null;
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

/** Extract listing URLs from an API response (including nested sub-listings). */
function extractUrlsFromApiResponse(
  response: ApiResponse,
  seen: Set<string>,
  out: DiscoveredUrl[]
): number {
  let added = 0;
  for (const result of response.results) {
    // Main listing — skip parent project pages (/new-developments/project-name/)
    // which have no listing ID. Only individual unit URLs have a numeric suffix.
    if (result.url) {
      const fullUrl = result.url.startsWith("http")
        ? result.url
        : `${ORIGIN}${result.url}`;
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
    // Nested sub-listings (e.g. multiple units in a building)
    if (result.nested && Array.isArray(result.nested)) {
      for (const nested of result.nested) {
        if (nested.url) {
          const fullUrl = nested.url.startsWith("http")
            ? nested.url
            : `${ORIGIN}${nested.url}`;
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

/** Polite API delay (shorter than HTML scrape delay since API is lighter) */
function apiDelay(): Promise<void> {
  const ms = 300 + Math.random() * 200;
  return new Promise((r) => setTimeout(r, ms));
}

/* ── Query types ─────────────────────────────────────────── */

interface ApiQuery {
  pathname: string;
  order_by: string;
  bedrooms?: number;
  label: string;
}

/**
 * Build the full query plan for maximum coverage.
 *
 * Strategy:
 * 1. For each category: date-desc + date-asc (covers sets ≤ 10k fully)
 * 2. For large categories (apartment ≈ 25.5k, house ≈ 9k): bedroom-filtered queries
 *    - Each bedroom slice is typically < 5k and fits in one pass
 *    - For apartment/bedrooms=1 (≈ 11.5k): use 4 sort orders
 *    - For apartment/bedrooms=2 (≈ 6.5k): use 2 sort orders
 * 3. price-asc + price-desc for apartment/house no-filter (extra coverage)
 */
function buildQueryPlan(): ApiQuery[] {
  const queries: ApiQuery[] = [];

  for (const cat of CATEGORIES) {
    // Base: dual sort for every category
    queries.push({ pathname: cat.pathname, order_by: "date-desc", label: `${cat.label}` });
    queries.push({ pathname: cat.pathname, order_by: "date-asc", label: `${cat.label}/asc` });
  }

  // Extra sort orders for apartment + house (large categories)
  for (const big of ["/rent/apartment/", "/rent/house/"]) {
    const label = big.includes("apartment") ? "apartment" : "house";
    queries.push({ pathname: big, order_by: "price-asc", label: `${label}/price-asc` });
    queries.push({ pathname: big, order_by: "price-desc", label: `${label}/price-desc` });
  }

  // Bedroom-filtered slices for apartment and house
  for (const big of ["/rent/apartment/", "/rent/house/"]) {
    const label = big.includes("apartment") ? "apartment" : "house";
    for (let bed = 0; bed <= 10; bed++) {
      queries.push({ pathname: big, bedrooms: bed, order_by: "date-desc", label: `${label}/bed=${bed}` });
    }
  }

  // Extra sort orders for large bedroom slices in apartment
  // bed=1 (≈ 11.5k): needs date-asc + price sorts to cover the middle
  for (const extra of ["date-asc", "price-asc", "price-desc"] as const) {
    queries.push({ pathname: "/rent/apartment/", bedrooms: 1, order_by: extra, label: `apartment/bed=1/${extra}` });
  }
  // bed=2 (≈ 6.5k): date-asc is enough for full coverage with date-desc
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
  console.log("║  Phase 1 — Discover via API                  ║");
  console.log(`║  Queries: ${String(queries.length).padEnd(3)} query sets                    ║`);
  console.log(`║  Max per query: ${API_PAGE_SIZE} × ${API_MAX_PAGE} = 5,000 results   ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];
    const qLabel = q.bedrooms !== undefined
      ? `${q.label} [${q.order_by}]`
      : `${q.label} [${q.order_by}]`;

    // First page: get count to decide if we should bother paginating
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

    log("info", `[${qi + 1}/${queries.length}] ${qLabel}: ${totalInSlice} total, up to ${maxPages} pages — page 1: +${added} new (${urls.length} total)`);

    // Paginate remaining pages
    for (let page = 2; page <= maxPages; page++) {
      await apiDelay();

      const resp = await fetchApiPage({
        pathname: q.pathname,
        page,
        order_by: q.order_by,
        bedrooms: q.bedrooms,
      });
      totalApiCalls++;

      if (!resp || resp.results.length === 0) {
        log("debug", `  page ${page}: empty/error, stopping this query`);
        break;
      }

      const pageAdded = extractUrlsFromApiResponse(resp, seen, urls);

      if (page % 10 === 0 || page === maxPages) {
        log("info", `  page ${page}/${maxPages}: +${pageAdded} new (${urls.length} total)`);
      }
    }

    const queryTotal = urls.length - beforeCount;
    log("info", `  → query added ${queryTotal} new URLs (running total: ${urls.length})`);
  }

  log("info", `\nDiscovery complete: ${urls.length} unique listing URLs from ${totalApiCalls} API calls across ${queries.length} query sets`);
  return urls;
}

/* ── Phase 2: Enqueue (skip already-scraped) ─────────────── */

async function enqueueNewUrls(discovered: DiscoveredUrl[]): Promise<{ newCount: number; rescrapeCount: number }> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 2 — Enqueue new + stale listings       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Get all existing listings with their lastSeenAt for staleness check
  const existingRows = await prisma.rentalListing.findMany({
    where: { source: SOURCE },
    select: { canonicalUrl: true, lastSeenAt: true },
  });
  const existingMap = new Map(existingRows.map((r) => [r.canonicalUrl, r.lastSeenAt]));
  log("info", `${existingMap.size} existing listings in DB for ${SOURCE}`);

  // Get anything currently PENDING/RETRY in queue (don't re-enqueue those)
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
    if (queuedUrls.has(d.url)) continue; // already in queue
    const lastSeen = existingMap.get(d.url);
    if (!lastSeen) {
      brandNew.push(d); // never scraped
    } else if (lastSeen < staleCutoff) {
      stale.push(d); // scraped before but stale — re-scrape for price changes
    }
    // else: recently scraped, skip
  }

  const recentlyScraped = discovered.length - brandNew.length - stale.length - queuedUrls.size;
  log("info", `${brandNew.length} brand new URLs to enqueue`);
  log("info", `${stale.length} stale URLs to re-scrape (not seen in ${RESCRAPE_DAYS}+ days)`);
  log("info", `${Math.max(0, recentlyScraped)} recently scraped (skipped)`);

  const toEnqueue = [...brandNew, ...stale];
  if (toEnqueue.length === 0) return { newCount: 0, rescrapeCount: 0 };

  // Upsert in batches — new items get PENDING, stale items get reset to PENDING
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

/* ── Phase 3: Process queue in batches ───────────────────── */

async function processAllBatches(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 3 — Process queue (scrape listings)   ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (totalProcessed < MAX_PROCESS) {
    // Check how many PENDING items remain
    const pendingCount = await prisma.scrapeQueue.count({
      where: {
        source: SOURCE,
        status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
      },
    });

    if (pendingCount === 0) {
      log("info", "Queue empty — all done!");
      break;
    }

    batchNum++;
    const batchMax = Math.min(BATCH_SIZE, MAX_PROCESS - totalProcessed);
    log("info", `\n── Batch ${batchNum}: processing up to ${batchMax} (${pendingCount} pending) ──`);

    const result = await processQueueJob(
      SOURCE,
      { maxItems: batchMax },
      log,
      progress
    );

    totalProcessed += result.processed;
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalFailed += result.failed;

    log(
      "info",
      `Batch ${batchNum} done — cumulative: ${totalProcessed} processed, ` +
        `${totalInserted} inserted, ${totalUpdated} updated, ${totalFailed} failed`
    );

    if (result.processed === 0) break; // safety
  }

  console.log("\n┌────────────────────────────────────────┐");
  console.log(`│  Total processed: ${String(totalProcessed).padStart(6)}`);
  console.log(`│  Total inserted:  ${String(totalInserted).padStart(6)}`);
  console.log(`│  Total updated:   ${String(totalUpdated).padStart(6)}`);
  console.log(`│  Total failed:    ${String(totalFailed).padStart(6)}`);
  console.log("└────────────────────────────────────────┘");
}

/* ── Main ────────────────────────────────────────────────── */

import { execFile } from "child_process";
import path from "path";

/**
 * Spawn N worker child processes, each running --process-only --_worker.
 * The atomic queue claiming ensures no duplicate work.
 */
async function spawnWorkers(count: number): Promise<void> {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Spawning ${count} parallel workers                 ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const scriptPath = path.resolve(__dirname, "scrape-realestate-full.ts");
  const perWorkerMax = Math.ceil(MAX_PROCESS / count);

  const workers = Array.from({ length: count }, (_, i) => {
    const workerId = i + 1;
    return new Promise<void>((resolve, reject) => {
      const args = [
        scriptPath,
        "--process-only",
        "--_worker",
        "--max-process", String(perWorkerMax),
        "--batch-size", String(BATCH_SIZE),
      ];
      const child = execFile("npx", ["tsx", ...args], {
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024,
        shell: true,
      }, (err) => {
        if (err) {
          console.error(`[Worker ${workerId}] exited with error:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });

      // Prefix child stdout/stderr with worker ID
      child.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().trimEnd().split("\n");
        for (const line of lines) {
          console.log(`[W${workerId}] ${line}`);
        }
      });
      child.stderr?.on("data", (data: Buffer) => {
        const lines = data.toString().trimEnd().split("\n");
        for (const line of lines) {
          console.error(`[W${workerId}] ${line}`);
        }
      });
    });
  });

  const results = await Promise.allSettled(workers);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`\nWorkers done: ${succeeded} succeeded, ${failed} failed`);
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  realestate.com.kh — Full Residential Scrape          ║");
  console.log("║  Apartments, Condos, Serviced Apts, Penthouses,       ║");
  console.log("║  Houses, Villas, Townhouses — via JSON API             ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const start = Date.now();

  if (!PROCESS_ONLY) {
    const discovered = await discoverAll();

    if (discovered.length > 0) {
      const { newCount, rescrapeCount } = await enqueueNewUrls(discovered);
      log("info", `Enqueued ${newCount} new + ${rescrapeCount} stale listings for scraping`);
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

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  log("info", `\n✔ Full scrape completed in ${elapsed} minutes`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
