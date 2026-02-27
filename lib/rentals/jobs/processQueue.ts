/**
 * Process Queue Job
 *
 * Takes PENDING items from ScrapeQueue, fetches and parses each listing,
 * upserts into RentalListing, and creates a RentalSnapshot.
 * Respects PROCESS_QUEUE_MAX cap per run.
 */

import { prisma } from "@/lib/prisma";
import { RentalSource, QueueStatus } from "@prisma/client";
import { isSourceEnabled, PROCESS_QUEUE_MAX } from "../config";
import { scrapeListingKhmer24 } from "../sources/khmer24";
import { scrapeListingRealestateKh } from "../sources/realestate-kh";
import { computeFingerprint } from "../fingerprint";
import { politeDelay } from "../http";

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
  options?: ProcessQueueOptions
): Promise<ProcessQueueResult> {
  const maxItems = options?.maxItems ?? PROCESS_QUEUE_MAX;

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

    const startTime = Date.now();

    for (const item of items) {
      processed++;

      try {
        // Scrape the listing
        const scraped = await scrapeForSource(source, item.canonicalUrl);

        if (!scraped) {
          // Mark as RETRY if under 3 attempts; DONE otherwise
          await prisma.scrapeQueue.update({
            where: { id: item.id },
            data: {
              status: item.attempts + 1 >= 3 ? QueueStatus.DONE : QueueStatus.RETRY,
              attempts: item.attempts + 1,
              lastError: "Failed to scrape or filtered out (not condo/apartment)",
            },
          });
          failed++;
          await politeDelay();
          continue;
        }

        const now = new Date();
        const imageUrlsJson = scraped.imageUrls.length > 0
          ? JSON.stringify(scraped.imageUrls)
          : null;

        // Compute fingerprint if no sourceListingId
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

        // Upsert listing
        const existing = await prisma.rentalListing.findUnique({
          where: { canonicalUrl: item.canonicalUrl },
        });

        let listingId: string;

        if (existing) {
          // Update existing listing
          await prisma.rentalListing.update({
            where: { id: existing.id },
            data: {
              title: scraped.title,
              description: scraped.description,
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
          updated++;
        } else {
          // Insert new listing
          const newListing = await prisma.rentalListing.create({
            data: {
              source,
              sourceListingId: scraped.sourceListingId ?? item.sourceListingId,
              canonicalUrl: item.canonicalUrl,
              title: scraped.title,
              description: scraped.description,
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
          inserted++;
        }

        // Create snapshot
        await prisma.rentalSnapshot.create({
          data: {
            listingId,
            city: "Phnom Penh",
            district: scraped.district,
            bedrooms: scraped.bedrooms,
            propertyType: scraped.propertyType,
            priceMonthlyUsd: scraped.priceMonthlyUsd,
            postedAt: scraped.postedAt,
          },
        });
        snapshots++;

        // Mark queue item done
        await prisma.scrapeQueue.update({
          where: { id: item.id },
          data: {
            status: QueueStatus.DONE,
            attempts: item.attempts + 1,
            lastError: null,
          },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await prisma.scrapeQueue.update({
          where: { id: item.id },
          data: {
            status: item.attempts + 1 >= 3 ? QueueStatus.DONE : QueueStatus.RETRY,
            attempts: item.attempts + 1,
            lastError: errMsg.slice(0, 2000),
          },
        });
        failed++;
      }

      await politeDelay();
    }

    const endTime = Date.now();

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: failed === processed && processed > 0 ? "FAILED" : "SUCCESS",
        endedAt: new Date(),
        durationMs: endTime - startTime,
        processedCount: processed,
        insertedCount: inserted,
        updatedCount: updated,
        snapshotCount: snapshots,
      },
    });

    return { jobRunId: jobRun.id, processed, inserted, updated, snapshots, failed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
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

async function scrapeForSource(source: RentalSource, url: string) {
  switch (source) {
    case "KHMER24":
      return scrapeListingKhmer24(url);
    case "REALESTATE_KH":
      return scrapeListingRealestateKh(url);
    default:
      return null;
  }
}
