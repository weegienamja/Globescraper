/**
 * POST /api/tools/rentals/discover?source=KHMER24|REALESTATE_KH
 *
 * Triggers the discover-listings job for the specified source.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { discoverListingsJob } from "@/lib/rentals/jobs/discover";
import { RentalSource } from "@prisma/client";

const VALID_SOURCES = new Set<string>(["KHMER24", "REALESTATE_KH"]);

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const source = req.nextUrl.searchParams.get("source");
  if (!source || !VALID_SOURCES.has(source)) {
    return NextResponse.json(
      { error: "Invalid source. Use ?source=KHMER24 or ?source=REALESTATE_KH" },
      { status: 400 }
    );
  }

  try {
    const result = await discoverListingsJob(source as RentalSource);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
