/**
 * POST /api/tools/rentals/build-index
 *
 * Triggers the build-daily-index job. Computes aggregate stats
 * for yesterday UTC by default.
 * Admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { buildDailyIndexJob } from "@/lib/rentals/jobs/buildIndex";

export async function POST() {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const result = await buildDailyIndexJob();
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
