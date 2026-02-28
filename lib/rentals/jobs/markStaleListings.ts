/**
 * Mark Stale Listings Job
 *
 * Safety net: marks listings as isActive = false when they haven't
 * been re-scraped (lastSeenAt) in more than STALE_DAYS days.
 *
 * This catches listings that silently disappeared from source sites
 * without returning an explicit 404 — e.g. the source removed the
 * listing page but discover stopped finding the URL in category pages.
 *
 * Historical data (RentalSnapshot rows) is preserved — only the
 * isActive flag flips. Inactive listings still contribute to the
 * analytics dashboard's historical trend data.
 */

import { prisma } from "@/lib/prisma";
import { type PipelineLogFn, noopLogger } from "../pipelineLogger";

/** Default: listings not seen in 7 days are considered stale. */
const DEFAULT_STALE_DAYS = 7;

export interface MarkStaleResult {
  /** Number of listings flipped to inactive */
  deactivated: number;
  /** Number of listings that were already inactive */
  alreadyInactive: number;
  /** Cutoff date used */
  cutoffDate: Date;
}

/**
 * Mark listings inactive if lastSeenAt is older than `staleDays` ago.
 */
export async function markStaleListingsJob(
  staleDays: number = DEFAULT_STALE_DAYS,
  log: PipelineLogFn = noopLogger
): Promise<MarkStaleResult> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - staleDays);

  log("info", `Marking listings stale if lastSeenAt < ${cutoff.toISOString().slice(0, 10)} (${staleDays} days)`);

  // Count how many are already inactive (for reporting)
  const alreadyInactive = await prisma.rentalListing.count({
    where: { isActive: false },
  });

  // Bulk update: flip isActive for stale listings
  const result = await prisma.rentalListing.updateMany({
    where: {
      isActive: true,
      lastSeenAt: { lt: cutoff },
    },
    data: {
      isActive: false,
    },
  });

  if (result.count > 0) {
    log("info", `⊘ Deactivated ${result.count} stale listings (not seen since ${cutoff.toISOString().slice(0, 10)})`);
  } else {
    log("info", `✓ No stale listings found — all active listings seen within ${staleDays} days`);
  }

  log("info", `  Total inactive listings: ${alreadyInactive + result.count}`);

  return {
    deactivated: result.count,
    alreadyInactive,
    cutoffDate: cutoff,
  };
}
