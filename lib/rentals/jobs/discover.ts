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
import { type PipelineLogFn, type PipelineProgressFn, noopLogger, noopProgress } from "../pipelineLogger";

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
  log: PipelineLogFn = noopLogger,
  progress: PipelineProgressFn = noopProgress
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
    progress({ phase: "discover", percent: 5, label: `Connecting to ${source}…` });
    log("info", `Running ${source} adapter — crawling category pages for listing URLs…`);
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
    progress({ phase: "discover", percent: 50, label: `Found ${discovered.length} listing URLs` });
    log("info", `Adapter returned ${discovered.length} listing URLs from category pages`);

    // Cap results
    const capped = discovered.slice(0, maxUrls);
    if (capped.length < discovered.length) {
      log("info", `Capped to ${maxUrls} URLs (${discovered.length} found)`);
    }

    // Enqueue URLs (upsert to avoid duplicates)
    log("info", `Enqueueing ${capped.length} URLs to scrape queue…`);
    let queued = 0;
    let skippedDuplicate = 0;

    for (let i = 0; i < capped.length; i++) {
      const item = capped[i];
      const pct = 50 + Math.round((i / capped.length) * 45);
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
            updatedAt: new Date(),
          },
        });
        queued++;
        if (queued % 10 === 0 || i === capped.length - 1) {
          progress({ phase: "discover", percent: pct, label: `Enqueued ${queued}/${capped.length} URLs` });
          log("info", `Enqueued ${queued}/${capped.length} URLs so far…`);
        }
        log("debug", `✓ Queued: ${item.url}`, { sourceListingId: item.sourceListingId });
      } catch {
        skippedDuplicate++;
        log("debug", `↩ Duplicate skipped: ${item.url}`);
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    progress({ phase: "discover", percent: 100, label: `Done — ${queued} queued, ${skippedDuplicate} duplicates` });
    log("info", `Enqueue complete: ${queued} new URLs queued, ${skippedDuplicate} duplicates skipped`);
    log("info", `✔ Discover finished in ${(durationMs / 1000).toFixed(1)}s — ${capped.length} found, ${queued} queued`);

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
