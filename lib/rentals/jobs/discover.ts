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
import { type PipelineLogFn, noopLogger } from "../pipelineLogger";

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
  options?: DiscoverOptions,
  log: PipelineLogFn = noopLogger
): Promise<DiscoverResult> {
  const maxUrls = options?.maxUrls ?? DISCOVER_MAX_URLS;
  log("info", `Starting discover job for ${source} (max ${maxUrls} URLs)`);

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
      return { jobRunId: jobRun.id, discovered: 0, queued: 0, skippedDuplicate: 0 };
    }

    // Run the appropriate adapter
    log("info", `Running ${source} adapter...`);
    const startTime = Date.now();
    let discovered;
    switch (source) {
      case "KHMER24":
        discovered = await discoverKhmer24(log);
        break;
      case "REALESTATE_KH":
        discovered = await discoverRealestateKh(log);
        break;
      default:
        throw new Error(`Unknown source: ${source}`);
    }
    log("info", `Adapter returned ${discovered.length} listing URLs`);

    // Cap results
    const capped = discovered.slice(0, maxUrls);
    if (capped.length < discovered.length) {
      log("info", `Capped to ${maxUrls} URLs (${discovered.length} found)`);
    }

    // Enqueue URLs (upsert to avoid duplicates)
    log("info", `Enqueueing ${capped.length} URLs to scrape queue...`);
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
        log("debug", `Queued: ${item.url}`, { sourceListingId: item.sourceListingId });
      } catch {
        skippedDuplicate++;
        log("debug", `Duplicate skipped: ${item.url}`);
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    log("info", `Enqueue complete: ${queued} queued, ${skippedDuplicate} duplicates skipped`);
    log("info", `Discover job finished in ${(durationMs / 1000).toFixed(1)}s — ${capped.length} discovered, ${queued} queued`);

    // Update JobRun
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "SUCCESS",
        endedAt: new Date(),
        durationMs,
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
    log("error", `Discover job failed: ${msg}`);
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
