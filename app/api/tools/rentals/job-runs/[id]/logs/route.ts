/**
 * GET /api/tools/rentals/job-runs/[id]/logs
 *
 * Returns the saved log entries for a specific JobRun.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const jobRun = await prisma.jobRun.findUnique({
      where: { id: params.id },
      select: { id: true, logEntries: true },
    });

    if (!jobRun) {
      return NextResponse.json({ error: "Job run not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: jobRun.id,
      logEntries: jobRun.logEntries ?? [],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
