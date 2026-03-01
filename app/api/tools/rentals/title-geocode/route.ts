/**
 * POST /api/tools/rentals/title-geocode — generate titles via reverse geocoding
 *
 * Admin-only. Processes up to `limit` listings per request.
 * Body: { limit?: number, force?: boolean, geoOnly?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { runTitleGeocoding } from "@/lib/rentals/title-geocode";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(200, Math.max(1, body.limit || 50));
    const force = !!body.force;
    const geoOnly = !!body.geoOnly;

    const logs: string[] = [];
    const result = await runTitleGeocoding({
      limit,
      force,
      geoOnly,
      dryRun: false,
      log: (msg: string) => logs.push(msg),
    });

    return NextResponse.json({
      ok: true,
      ...result,
      logs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
