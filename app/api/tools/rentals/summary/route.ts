/**
 * GET /api/tools/rentals/summary
 *
 * Returns dashboard summary: total listings, today's count,
 * snapshots, last updated, source breakdown, recent job runs,
 * and market overview.
 * Admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      totalListings,
      listingsToday,
      totalSnapshots,
      lastListing,
      khmer24Count,
      realestateCount,
      recentJobs,
      marketOverview,
    ] = await Promise.all([
      prisma.rentalListing.count(),
      prisma.rentalListing.count({
        where: { firstSeenAt: { gte: todayStart } },
      }),
      prisma.rentalSnapshot.count(),
      prisma.rentalListing.findFirst({
        orderBy: { lastSeenAt: "desc" },
        select: { lastSeenAt: true },
      }),
      prisma.rentalListing.count({ where: { source: "KHMER24" } }),
      prisma.rentalListing.count({ where: { source: "REALESTATE_KH" } }),
      prisma.jobRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          jobType: true,
          source: true,
          status: true,
          startedAt: true,
          endedAt: true,
          durationMs: true,
          discoveredCount: true,
          processedCount: true,
          insertedCount: true,
          updatedCount: true,
          snapshotCount: true,
          indexRowsCount: true,
          errorMessage: true,
        },
      }),
      // Market overview: aggregate for Phnom Penh
      prisma.rentalIndexDaily.findFirst({
        where: { city: "Phnom Penh" },
        orderBy: { date: "desc" },
      }),
    ]);

    // Get total active listings in Phnom Penh for market overview
    const phnomPenhActive = await prisma.rentalListing.count({
      where: { city: "Phnom Penh", isActive: true },
    });

    // Get median price for Phnom Penh overview
    const latestIndex = await prisma.rentalIndexDaily.findMany({
      where: {
        city: "Phnom Penh",
        date: marketOverview?.date ?? todayStart,
      },
      select: { medianPriceUsd: true, listingCount: true },
    });

    const overallMedian =
      latestIndex.length > 0
        ? latestIndex.reduce((sum, r) => sum + (r.medianPriceUsd ?? 0), 0) / latestIndex.length
        : null;

    return NextResponse.json({
      totalListings,
      listingsToday,
      totalSnapshots,
      lastUpdated: lastListing?.lastSeenAt ?? null,
      sourceCounts: {
        KHMER24: khmer24Count,
        REALESTATE_KH: realestateCount,
      },
      recentJobs,
      marketOverview: {
        city: "Phnom Penh",
        activeListings: phnomPenhActive,
        medianPriceUsd: overallMedian ? Math.round(overallMedian) : null,
        lastIndexDate: marketOverview?.date ?? null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
