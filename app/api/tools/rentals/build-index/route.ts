/**
 * POST /api/tools/rentals/build-index
 *
 * Triggers the build-daily-index job. Builds for both today and yesterday
 * UTC to ensure freshly scraped data is indexed.
 * Admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { buildDailyIndexJob } from "@/lib/rentals/jobs/buildIndex";

export async function POST() {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    // Build for today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const resultToday = await buildDailyIndexJob({ date: today });

    // Also build for yesterday (the original default)
    const resultYesterday = await buildDailyIndexJob();

    return NextResponse.json({
      today: resultToday,
      yesterday: resultYesterday,
      indexRows: resultToday.indexRows + resultYesterday.indexRows,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
