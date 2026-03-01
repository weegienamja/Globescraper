/**
 * Script: Full realestate.com.kh scrape — ALL property types
 *
 * Crawls ALL pages of https://www.realestate.com.kh/rent/ (no category
 * filter) to discover every rental listing on the site (~34,500+).
 * Discovers listing URLs, skips already-scraped ones, enqueues new ones,
 * and processes the queue through the existing pipeline.
 *
 * Property types scraped: Condo, Apartment, Serviced Apartment, Penthouse,
 * House, Villa, Townhouse, Shophouse, Land, Commercial, Warehouse, Office.
 *
 * Usage:
 *   npx tsx scripts/scrape-realestate-all.ts
 *   npx tsx scripts/scrape-realestate-all.ts --discover-only
 *   npx tsx scripts/scrape-realestate-all.ts --process-only
 *   npx tsx scripts/scrape-realestate-all.ts --max-pages 50
 *   npx tsx scripts/scrape-realestate-all.ts --max-process 500
 *   npx tsx scripts/scrape-realestate-all.ts --batch-size 100
 *   npx tsx scripts/scrape-realestate-all.ts --resume
 */

/* ── CLI args ────────────────────────────────────────────── */

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}
const hasFlag = (name: string) => process.argv.includes(name);

const MAX_PAGES = getArg("--max-pages", 99999);
const MAX_PROCESS = getArg("--max-process", 99999);
const BATCH_SIZE = getArg("--batch-size", 200);
const DISCOVER_ONLY = hasFlag("--discover-only");
const PROCESS_ONLY = hasFlag("--process-only");
const RESUME = hasFlag("--resume"); // skip discover, just process existing queue

// Lift pipeline caps so processQueueJob doesn't limit itself
process.env.RENTALS_MAX_PROCESS = String(BATCH_SIZE);

/* ── Imports ─────────────────────────────────────────────── */

import * as cheerio from "cheerio";
import { prisma } from "../lib/prisma";
import { QueueStatus, RentalSource } from "@prisma/client";
import { fetchHtml, politeDelay } from "../lib/rentals/http";
import { canonicalizeUrl } from "../lib/rentals/url";
import { processQueueJob } from "../lib/rentals/jobs/processQueue";
import type { PipelineLogFn, PipelineProgressFn } from "../lib/rentals/pipelineLogger";

/* ── Constants ───────────────────────────────────────────── */

const SOURCE: RentalSource = "REALESTATE_KH";

/**
 * Base search URL — NO category filter so we get ALL property types.
 * Sorted by newest first. No location filter (all of Cambodia).
 */
const BASE_SEARCH_URL =
  "https://www.realestate.com.kh/rent/" +
  "?order_by=date-desc" +
  "&search_type=rent";

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

/* ── Helpers ─────────────────────────────────────────────── */

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("realestate.com.kh")) return false;
    const path = u.pathname;
    // Listing pages end with a 5+ digit numeric ID
    if (/\d{5,}\/?\s*$/.test(path)) {
      if (path.includes("/rent/") || path.includes("/new-developments/")) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function extractListingId(url: string): string | null {
  const match = url.match(/-(\d{5,})\/?(?:[?#]|$)/);
  return match ? match[1] : null;
}

interface DiscoveredUrl {
  url: string;
  sourceListingId: string | null;
}

/* ── Phase 1: Discover ───────────────────────────────────── */

async function discoverAll(): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  let page = 1;
  let emptyPagesInRow = 0;
  let totalLinksLastPage = 0;

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 1 — Discover ALL listing URLs         ║");
  console.log("║  (every property type, all of Cambodia)      ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  while (page <= MAX_PAGES && emptyPagesInRow < 5) {
    const pageUrl = `${BASE_SEARCH_URL}&page=${page}`;
    log("info", `Page ${page}: fetching search results…`);

    let html: string | null = null;
    let retries = 0;
    while (retries < 3) {
      html = await fetchHtml(pageUrl);
      if (html) break;
      retries++;
      log("warn", `Page ${page}: retry ${retries}/3…`);
      await new Promise((r) => setTimeout(r, 2000 * retries));
    }

    if (!html) {
      log("warn", `Page ${page}: no HTML returned after retries, stopping.`);
      break;
    }

    const $ = cheerio.load(html);
    let found = 0;

    // Extract listing links from multiple selectors
    const selectors = [
      "article a[href]",
      "div.info.listing a[href]",
      "a[href*='/rent/']",
    ];
    for (const sel of selectors) {
      $(sel).each((_i, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        const full = href.startsWith("http")
          ? href
          : `https://www.realestate.com.kh${href}`;

        if (!isListingUrl(full)) return;

        const canonical = canonicalizeUrl(full);
        if (seen.has(canonical)) return;
        seen.add(canonical);

        urls.push({
          url: canonical,
          sourceListingId: extractListingId(full),
        });
        found++;
      });
    }

    if (found === 0) {
      emptyPagesInRow++;
      log("warn", `Page ${page}: 0 new listings (${emptyPagesInRow} empty pages in a row)`);
    } else {
      emptyPagesInRow = 0;
      totalLinksLastPage = found;
      log("info", `Page ${page}: +${found} new URLs (total: ${urls.length})`);
    }

    // Progress estimate (realestate.com.kh shows ~25 listings/page, ~1400 pages for 34,500)
    if (page % 50 === 0) {
      log("info", `═══ Progress checkpoint: ${urls.length} unique URLs from ${page} pages ═══`);
    }

    page++;
    await politeDelay();
  }

  log("info", `Discovery complete: ${urls.length} unique listing URLs from ${page - 1} pages`);
  return urls;
}

/* ── Phase 2: Enqueue (skip already-scraped) ─────────────── */

async function enqueueNewUrls(discovered: DiscoveredUrl[]): Promise<number> {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Phase 2 — Enqueue new listings              ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Get all existing canonical URLs for this source
  const existingRows = await prisma.rentalListing.findMany({
    where: { source: SOURCE },
    select: { canonicalUrl: true },
  });
  const existingUrls = new Set(existingRows.map((r) => r.canonicalUrl));
  log("info", `${existingUrls.size} existing listings in DB for ${SOURCE}`);

  // Also get anything currently PENDING/RETRY in queue
  const queuedRows = await prisma.scrapeQueue.findMany({
    where: {
      source: SOURCE,
      status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
    },
    select: { canonicalUrl: true },
  });
  const queuedUrls = new Set(queuedRows.map((r) => r.canonicalUrl));
  log("info", `${queuedUrls.size} already pending in queue`);

  const toEnqueue = discovered.filter(
    (d) => !existingUrls.has(d.url) && !queuedUrls.has(d.url)
  );
  log("info", `${toEnqueue.length} new URLs to enqueue (${discovered.length - toEnqueue.length} already scraped/queued)`);

  if (toEnqueue.length === 0) return 0;

  // Batch upsert
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

  return queued;
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

    // Log type distribution every 5 batches
    if (batchNum % 5 === 0) {
      const typeCounts = await prisma.rentalListing.groupBy({
        by: ["propertyType"],
        where: { source: SOURCE, isActive: true },
        _count: { id: true },
      });
      const dist = typeCounts
        .sort((a, b) => b._count.id - a._count.id)
        .map((t) => `${t.propertyType}: ${t._count.id}`)
        .join(", ");
      log("info", `Property type distribution: ${dist}`);
    }

    if (result.processed === 0) break;
  }

  // Final summary
  const typeCounts = await prisma.rentalListing.groupBy({
    by: ["propertyType"],
    where: { source: SOURCE, isActive: true },
    _count: { id: true },
  });

  console.log("\n┌────────────────────────────────────────────┐");
  console.log(`│  Total processed: ${String(totalProcessed).padStart(8)}`);
  console.log(`│  Total inserted:  ${String(totalInserted).padStart(8)}`);
  console.log(`│  Total updated:   ${String(totalUpdated).padStart(8)}`);
  console.log(`│  Total failed:    ${String(totalFailed).padStart(8)}`);
  console.log("├────────────────────────────────────────────┤");
  console.log("│  Property Type Breakdown:");
  for (const tc of typeCounts.sort((a, b) => b._count.id - a._count.id)) {
    console.log(`│    ${tc.propertyType.padEnd(20)} ${String(tc._count.id).padStart(6)}`);
  }
  console.log("└────────────────────────────────────────────┘");
}

/* ── Main ────────────────────────────────────────────────── */

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  realestate.com.kh — Full Site Scrape (ALL TYPES)    ║");
  console.log("║  Target: ~34,500+ properties across all of Cambodia  ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const start = Date.now();

  if (!PROCESS_ONLY && !RESUME) {
    const discovered = await discoverAll();

    if (discovered.length > 0) {
      const queued = await enqueueNewUrls(discovered);
      log("info", `Enqueued ${queued} new listings for scraping`);
    }

    if (DISCOVER_ONLY) {
      log("info", "Discover-only mode — skipping process phase.");
      await prisma.$disconnect();
      return;
    }
  }

  if (RESUME) {
    const pendingCount = await prisma.scrapeQueue.count({
      where: {
        source: SOURCE,
        status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
      },
    });
    log("info", `Resume mode: ${pendingCount} items pending in queue`);
  }

  await processAllBatches();

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  log("info", `\n✔ Full scrape completed in ${elapsed} minutes`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
