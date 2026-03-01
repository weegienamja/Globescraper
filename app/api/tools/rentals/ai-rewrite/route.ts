/**
 * POST /api/tools/rentals/ai-rewrite — trigger AI description rewriting
 *
 * Admin-only. Max 25 listings per web request to avoid timeout.
 * Body: { limit?: number, source?: string, force?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { runAiRewrite } from "@/lib/rentals/ai-rewrite";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(25, Math.max(1, body.limit || 10));
    const source = body.source || undefined;
    const force = !!body.force;

    const logs: string[] = [];
    const result = await runAiRewrite({
      dryRun: false,
      unrewritten: !force,
      force,
      limit,
      source,
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
