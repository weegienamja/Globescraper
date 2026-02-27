/**
 * Discover Listings Job
 *
 * Fetches category index pages from the given source adapter,
 * extracts listing URLs, and enqueues them in ScrapeQueue.
 * Logs a JobRun row with result counts.
 */

import { prisma } from "@/lib/prisma";
import { RentalSource, QueueStatus } from "@prisma/client";
import { isSourceEnabled, DISCOVER_MAX_URLS } from "../config";
import { discoverKhmer24 } from "../sources/khmer24";
import { discoverRealestateKh } from "../sources/realestate-kh";

export interface DiscoverOptions {
  maxUrls?: number;
}

export interface DiscoverResult {
  jobRunId: string;
  discovered: number;
  queued: number;
  skippedDuplicate: number;
}

/**
 * Run the discover job for a single source.
 * Returns counts and the JobRun ID.
 */
export async function discoverListingsJob(
  source: RentalSource,
  options?: DiscoverOptions
): Promise<DiscoverResult> {
  const maxUrls = options?.maxUrls ?? DISCOVER_MAX_URLS;

  // Create JobRun record
  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: "DISCOVER",
      source,
      status: "SUCCESS",
      startedAt: new Date(),
    },
  });

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
      return { jobRunId: jobRun.id, discovered: 0, queued: 0, skippedDuplicate: 0 };
    }

    // Run the appropriate adapter
    const startTime = Date.now();
    let discovered;
    switch (source) {
      case "KHMER24":
        discovered = await discoverKhmer24();
        break;
      case "REALESTATE_KH":
        discovered = await discoverRealestateKh();
        break;
      default:
        throw new Error(`Unknown source: ${source}`);
    }

    // Cap results
    const capped = discovered.slice(0, maxUrls);

    // Enqueue URLs (upsert to avoid duplicates)
    let queued = 0;
    let skippedDuplicate = 0;

    for (const item of capped) {
      try {
        await prisma.scrapeQueue.upsert({
          where: {
            source_canonicalUrl: {
              source,
              canonicalUrl: item.url,
            },
          },
          create: {
            source,
            canonicalUrl: item.url,
            sourceListingId: item.sourceListingId,
            status: QueueStatus.PENDING,
            priority: 0,
          },
          update: {
            // If it already exists and is DONE, re-queue as PENDING for freshness check
            // If PENDING or RETRY, just leave it
            updatedAt: new Date(),
          },
        });
        queued++;
      } catch {
        skippedDuplicate++;
      }
    }

    const endTime = Date.now();

    // Update JobRun
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "SUCCESS",
        endedAt: new Date(),
        durationMs: endTime - startTime,
        discoveredCount: capped.length,
        processedCount: queued,
      },
    });

    return {
      jobRunId: jobRun.id,
      discovered: capped.length,
      queued,
      skippedDuplicate,
    };
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
    return { jobRunId: jobRun.id, discovered: 0, queued: 0, skippedDuplicate: 0 };
  }
}
