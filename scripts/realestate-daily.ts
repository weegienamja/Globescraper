/**
 * Script: Daily light scrape — realestate.com.kh new listings
 *
 * Fetches newest listings via the JSON API sorted by date-desc,
 * stops paginating each category once it hits a threshold of
 * already-known URLs (i.e. we've caught up to old data).
 * Then processes the queue and rebuilds the daily index.
 *
 * Designed to run daily and finish quickly (5-15 minutes).
 *
 * Usage:
 *   npx tsx scripts/realestate-daily.ts
 *   npx tsx scripts/realestate-daily.ts --max-pages 20
 *   npx tsx scripts/realestate-daily.ts --stop-after-known 50
 */

/* ── CLI args ────────────────────────────────────────────── */

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}

/** Max API pages per category before moving on */
const MAX_PAGES = getArg("--max-pages", 15);
/** Stop paginating a category after this many consecutive already-known URLs */
const STOP_AFTER_KNOWN = getArg("--stop-after-known", 50);

/* ── Imports ─────────────────────────────────────────────── */

import { prisma } from "../lib/prisma";
import { QueueStatus, RentalSource } from "@prisma/client";
import { canonicalizeUrl } from "../lib/rentals/url";
import { processQueueJob } from "../lib/rentals/jobs/processQueue";
import { buildDailyIndexJob } from "../lib/rentals/jobs/buildIndex";
import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";
import { USER_AGENT } from "../lib/rentals/config";

/* ── Constants ───────────────────────────────────────────── */

const SOURCE: RentalSource = "REALESTATE_KH";
const API_BASE = "https://www.realestate.com.kh/api/portal/pages/results/";
const API_PAGE_SIZE = 100;
const ORIGIN = "https://www.realestate.com.kh";
const BATCH_SIZE = 100;

/**
 * Categories to scan. date-desc only — we just want the newest listings.
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

const progress: PipelineProgressFn = () => {};

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

async function fetchApiPage(pathname: string, page: number): Promise<ApiResponse | null> {
  const qs = new URLSearchParams({
    pathname,
    page_size: String(API_PAGE_SIZE),
    page: String(page),
    search_languages: "en",
    order_by: "-date",  // newest first — the key difference for daily scrape
  });

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
  return new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
}

function extractListingId(url: string): string | null {
  const match = url.match(/-(\d{5,})\/?(?:[?#]|$)/);
  return match ? match[1] : null;
}

/* ── Phase 1: Discover (newest-first, early stop) ────────── */

interface DiscoveredUrl {
  url: string;
  sourceListingId: string | null;
}

async function discoverNewListings(): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();

  // Load all known canonical URLs for this source
  const existingRows = await prisma.rentalListing.findMany({
    where: { source: SOURCE },
    select: { canonicalUrl: true },
  });
  const knownUrls = new Set(existingRows.map((r) => r.canonicalUrl));
  log("info", `${knownUrls.size} existing listings in DB`);

  let totalApiCalls = 0;

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Daily Discover — newest first, early stop    ║");
  console.log(`║  Categories: ${CATEGORIES.length}   Max pages/cat: ${String(MAX_PAGES).padStart(3)}        ║`);
  console.log(`║  Stop after ${String(STOP_AFTER_KNOWN).padStart(3)} consecutive known URLs      ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  for (const cat of CATEGORIES) {
    log("info", `Scanning: ${cat.label} (date-desc)`);

    let consecutiveKnown = 0;
    let catNew = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const resp = await fetchApiPage(cat.pathname, page);
      totalApiCalls++;

      if (!resp || resp.results.length === 0) break;

      let pageNew = 0;

      for (const result of resp.results) {
        // Process main result + nested
        const items = [result, ...(result.nested || [])];
        for (const item of items) {
          if (!item.url) continue;
          const fullUrl = item.url.startsWith("http") ? item.url : `${ORIGIN}${item.url}`;
          const listingId = extractListingId(fullUrl);
          if (!listingId) continue; // skip parent project pages

          const canonical = canonicalizeUrl(fullUrl);
          if (seen.has(canonical)) continue;
          seen.add(canonical);

          if (knownUrls.has(canonical)) {
            consecutiveKnown++;
          } else {
            consecutiveKnown = 0;
            urls.push({ url: canonical, sourceListingId: listingId });
            pageNew++;
            catNew++;
          }
        }
      }

      log("info", `  [${cat.label}] page ${page}: +${pageNew} new (${consecutiveKnown} consecutive known)`);

      // Early stop: if we're seeing mostly known listings, we've caught up
      if (consecutiveKnown >= STOP_AFTER_KNOWN) {
        log("info", `  → ${consecutiveKnown} consecutive known URLs, stopping ${cat.label}`);
        break;
      }

      await apiDelay();
    }

    log("info", `  [${cat.label}] found ${catNew} new URLs`);
  }

  log("info", `\nDiscovery complete: ${urls.length} new URLs from ${totalApiCalls} API calls`);
  return urls;
}

/* ── Phase 2: Enqueue ────────────────────────────────────── */

async function enqueueUrls(discovered: DiscoveredUrl[]): Promise<number> {
  if (discovered.length === 0) return 0;

  log("info", `Enqueuing ${discovered.length} new URLs…`);

  let queued = 0;
  const UPSERT_BATCH = 50;

  for (let i = 0; i < discovered.length; i += UPSERT_BATCH) {
    const batch = discovered.slice(i, i + UPSERT_BATCH);
    await Promise.all(
      batch.map((item) =>
        prisma.scrapeQueue.upsert({
          where: { source_canonicalUrl: { source: SOURCE, canonicalUrl: item.url } },
          create: {
            source: SOURCE,
            canonicalUrl: item.url,
            sourceListingId: item.sourceListingId,
            status: QueueStatus.PENDING,
            priority: 10, // higher priority than weekly re-scrapes
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

  log("info", `Enqueued ${queued} URLs`);
  return queued;
}

/* ── Phase 3: Process queue ──────────────────────────────── */

async function processQueue(): Promise<{ processed: number; inserted: number; updated: number; failed: number }> {
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  while (true) {
    const pendingCount = await prisma.scrapeQueue.count({
      where: {
        source: SOURCE,
        status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
      },
    });

    if (pendingCount === 0) break;

    const result = await processQueueJob(SOURCE, { maxItems: BATCH_SIZE }, log, progress);
    totalProcessed += result.processed;
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalFailed += result.failed;

    if (result.processed === 0) break;
  }

  return { processed: totalProcessed, inserted: totalInserted, updated: totalUpdated, failed: totalFailed };
}

/* ── Main ────────────────────────────────────────────────── */

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  realestate.com.kh — Daily New Listings Scrape        ║");
  console.log("║  Sorted newest-first • Stops at known listings        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const start = Date.now();

  // 1. Discover
  const discovered = await discoverNewListings();

  // 2. Enqueue
  const queued = await enqueueUrls(discovered);

  // 3. Process
  if (queued > 0) {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║  Processing queue (scraping listings)         ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    const result = await processQueue();
    log("info", `\nProcessed: ${result.processed} (${result.inserted} new, ${result.updated} updated, ${result.failed} failed)`);
  } else {
    log("info", "No new URLs to process — database is up to date!");
  }

  // 4. Rebuild index
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Rebuilding daily index                       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await buildDailyIndexJob({ date: todayUTC }, log, progress);

  // Done
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  const mins = Math.floor(Number(elapsed) / 60);
  const secs = Number(elapsed) % 60;

  console.log("\n┌────────────────────────────────────────┐");
  console.log(`│  New discovered:  ${String(discovered.length).padStart(6)}`);
  console.log(`│  Enqueued:        ${String(queued).padStart(6)}`);
  console.log(`│  Time:           ${String(mins).padStart(3)}m ${String(secs).padStart(2)}s`);
  console.log("└────────────────────────────────────────┘\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
