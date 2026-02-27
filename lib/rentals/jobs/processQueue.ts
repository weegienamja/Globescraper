/**
 * Process Queue Job
 *
 * Takes PENDING items from ScrapeQueue, fetches and parses each listing,
 * upserts into RentalListing, and creates a RentalSnapshot.
 * Respects PROCESS_QUEUE_MAX cap per run.
 */

import { prisma } from "@/lib/prisma";
import { RentalSource, QueueStatus } from "@prisma/client";
import { isSourceEnabled, PROCESS_QUEUE_MAX, PROCESS_QUEUE_CONCURRENCY } from "../config";
import { scrapeListingKhmer24 } from "../sources/khmer24";
import { scrapeListingRealestateKh } from "../sources/realestate-kh";
import { computeFingerprint } from "../fingerprint";
import { politeDelay } from "../http";
import { type PipelineLogFn, type PipelineProgressFn, noopLogger, noopProgress } from "../pipelineLogger";

export interface ProcessQueueOptions {
  maxItems?: number;
}

export interface ProcessQueueResult {
  jobRunId: string;
  processed: number;
  inserted: number;
  updated: number;
  snapshots: number;
  failed: number;
}

/**
 * Process queued listing URLs for the given source.
 */
export async function processQueueJob(
  source: RentalSource,
  options?: ProcessQueueOptions,
  log: PipelineLogFn = noopLogger,
  progress: PipelineProgressFn = noopProgress
): Promise<ProcessQueueResult> {
  const maxItems = options?.maxItems ?? PROCESS_QUEUE_MAX;
  log("info", `Starting process queue for ${source} (max ${maxItems} items)`);

  // Create JobRun
  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: "PROCESS_QUEUE",
      source,
      status: "SUCCESS",
      startedAt: new Date(),
    },
  });

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let snapshots = 0;
  let failed = 0;

  try {
    if (!isSourceEnabled(source)) {
      log("warn", `Source ${source} is disabled in config — aborting`);
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: "FAILED",
          endedAt: new Date(),
          durationMs: 0,
          errorMessage: `Source ${source} is disabled`,
        },
      });
      return { jobRunId: jobRun.id, processed: 0, inserted: 0, updated: 0, snapshots: 0, failed: 0 };
    }

    // Get pending items, ordered by priority desc and oldest first
    const items = await prisma.scrapeQueue.findMany({
      where: {
        source,
        status: { in: [QueueStatus.PENDING, QueueStatus.RETRY] },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: maxItems,
    });

    log("info", `Found ${items.length} pending items in queue`);
    if (items.length === 0) {
      progress({ phase: "process", percent: 100, label: "Queue empty — nothing to process" });
      log("info", "Queue is empty — nothing to scrape. Run Discover first.");
    } else {
      progress({ phase: "process", percent: 2, label: `Starting — ${items.length} listings to scrape…` });
    }
    const startTime = Date.now();

    /* ── Process in parallel batches ─────────────────────── */
    const BATCH_SIZE = PROCESS_QUEUE_CONCURRENCY;

    for (let batchStart = 0; batchStart < items.length; batchStart += BATCH_SIZE) {
      const batch = items.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);
      log("info", `── Batch ${batchNum}/${totalBatches}: scraping ${batch.length} listings concurrently…`);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const idx = batchStart + batch.indexOf(item) + 1;
          const shortUrl = item.canonicalUrl.replace(/^https?:\/\/[^/]+/, "");
          log("info", `[${idx}/${items.length}] Fetching: ${shortUrl}`);

          try {
            const scraped = await scrapeForSource(source, item.canonicalUrl, log);

            if (!scraped) {
              log("warn", `[${idx}/${items.length}] ✗ Filtered out (not condo/apartment or empty)`);
              await prisma.scrapeQueue.update({
                where: { id: item.id },
                data: {
                  status: item.attempts + 1 >= 3 ? QueueStatus.DONE : QueueStatus.RETRY,
                  attempts: item.attempts + 1,
                  lastError: "Failed to scrape or filtered out (not condo/apartment)",
                },
              });
              return { type: "failed" as const };
            }

            const now = new Date();
            const priceStr = scraped.priceMonthlyUsd ? `$${scraped.priceMonthlyUsd}/mo` : "no price";
            log("info", `[${idx}/${items.length}] Parsed: ${scraped.title?.slice(0, 60) || "(no title)"}`, {
              type: scraped.propertyType,
              district: scraped.district || "unknown",
              city: scraped.city || "Phnom Penh",
              price: priceStr,
              beds: scraped.bedrooms ?? "?",
              baths: scraped.bathrooms ?? "?",
              size: scraped.sizeSqm ? `${scraped.sizeSqm}m²` : "?",
              images: scraped.imageUrls.length,
            });

            const imageUrlsJson = scraped.imageUrls.length > 0
              ? JSON.stringify(scraped.imageUrls)
              : null;

            const fingerprint = !scraped.sourceListingId
              ? computeFingerprint({
                  title: scraped.title,
                  district: scraped.district,
                  bedrooms: scraped.bedrooms,
                  propertyType: scraped.propertyType,
                  priceMonthlyUsd: scraped.priceMonthlyUsd,
                  firstImageUrl: scraped.imageUrls[0] ?? null,
                })
              : null;

            const existing = await prisma.rentalListing.findUnique({
              where: { canonicalUrl: item.canonicalUrl },
            });

            let listingId: string;
            let wasInserted = false;

            if (existing) {
              await prisma.rentalListing.update({
                where: { id: existing.id },
                data: {
                  title: scraped.title,
                  description: scraped.description,
                  city: scraped.city ?? "Phnom Penh",
                  district: scraped.district,
                  propertyType: scraped.propertyType,
                  bedrooms: scraped.bedrooms,
                  bathrooms: scraped.bathrooms,
                  sizeSqm: scraped.sizeSqm,
                  priceOriginal: scraped.priceOriginal,
                  priceMonthlyUsd: scraped.priceMonthlyUsd,
                  currency: scraped.currency,
                  imageUrlsJson,
                  postedAt: scraped.postedAt,
                  lastSeenAt: now,
                  isActive: true,
                  contentFingerprint: fingerprint ?? existing.contentFingerprint,
                },
              });
              listingId = existing.id;
              log("info", `[${idx}/${items.length}] ✓ Updated existing listing (${priceStr}, ${scraped.district || "no district"})`);
            } else {
              const newListing = await prisma.rentalListing.create({
                data: {
                  source,
                  sourceListingId: scraped.sourceListingId ?? item.sourceListingId,
                  canonicalUrl: item.canonicalUrl,
                  title: scraped.title,
                  description: scraped.description,
                  city: scraped.city ?? "Phnom Penh",
                  district: scraped.district,
                  propertyType: scraped.propertyType,
                  bedrooms: scraped.bedrooms,
                  bathrooms: scraped.bathrooms,
                  sizeSqm: scraped.sizeSqm,
                  priceOriginal: scraped.priceOriginal,
                  priceMonthlyUsd: scraped.priceMonthlyUsd,
                  currency: scraped.currency,
                  imageUrlsJson,
                  postedAt: scraped.postedAt,
                  firstSeenAt: now,
                  lastSeenAt: now,
                  isActive: true,
                  contentFingerprint: fingerprint,
                },
              });
              listingId = newListing.id;
              wasInserted = true;
              log("info", `[${idx}/${items.length}] ✓ Inserted NEW listing (${priceStr}, ${scraped.district || "no district"})`);
            }

            await prisma.rentalSnapshot.create({
              data: {
                listingId,
                city: scraped.city ?? "Phnom Penh",
                district: scraped.district,
                bedrooms: scraped.bedrooms,
                propertyType: scraped.propertyType,
                priceMonthlyUsd: scraped.priceMonthlyUsd,
                postedAt: scraped.postedAt,
              },
            });

            await prisma.scrapeQueue.update({
              where: { id: item.id },
              data: {
                status: QueueStatus.DONE,
                attempts: item.attempts + 1,
                lastError: null,
              },
            });

            return { type: wasInserted ? "inserted" as const : "updated" as const };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log("error", `[${idx}/${items.length}] ✗ Failed: ${errMsg}`);
            await prisma.scrapeQueue.update({
              where: { id: item.id },
              data: {
                status: item.attempts + 1 >= 3 ? QueueStatus.DONE : QueueStatus.RETRY,
                attempts: item.attempts + 1,
                lastError: errMsg.slice(0, 2000),
              },
            });
            return { type: "failed" as const };
          }
        })
      );

      /* Tally batch results */
      for (const r of results) {
        processed++;
        if (r.status === "fulfilled") {
          if (r.value.type === "inserted") { inserted++; snapshots++; }
          else if (r.value.type === "updated") { updated++; snapshots++; }
          else { failed++; }
        } else {
          failed++;
        }
      }

      /* Report progress */
      const pct = Math.round((processed / items.length) * 100);
      progress({ phase: "process", percent: pct, label: `Scraped ${processed}/${items.length} listings (${inserted} new, ${updated} updated, ${failed} failed)` });
      log("info", `Batch ${batchNum} done — running totals: ${processed}/${items.length} processed, ${inserted} new, ${updated} updated, ${failed} failed`);

      /* Brief pause between batches (not between each item) */
      if (batchStart + BATCH_SIZE < items.length) {
        await politeDelay();
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    log("info", `✔ Process queue finished in ${(durationMs / 1000).toFixed(1)}s — ${processed} scraped, ${inserted} new, ${updated} updated, ${snapshots} snapshots, ${failed} failed`);
    progress({ phase: "process", percent: 100, label: `Done — ${processed} scraped, ${inserted} new, ${updated} updated` });

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: failed === processed && processed > 0 ? "FAILED" : "SUCCESS",
        endedAt: new Date(),
        durationMs,
        processedCount: processed,
        insertedCount: inserted,
        updatedCount: updated,
        snapshotCount: snapshots,
      },
    });

    return { jobRunId: jobRun.id, processed, inserted, updated, snapshots, failed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("error", `Process queue job failed: ${msg}`);
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        durationMs: Date.now() - jobRun.startedAt.getTime(),
        errorMessage: msg.slice(0, 2000),
      },
    });
    return { jobRunId: jobRun.id, processed, inserted, updated, snapshots, failed };
  }
}

/* ── Helper: dispatch to correct adapter ─────────────────── */
import type { PipelineLogFn as _LogFn } from "../pipelineLogger";

async function scrapeForSource(source: RentalSource, url: string, log?: _LogFn) {
  switch (source) {
    case "KHMER24":
      return scrapeListingKhmer24(url);
    case "REALESTATE_KH":
      return scrapeListingRealestateKh(url, log);
    default:
      return null;
  }
}
