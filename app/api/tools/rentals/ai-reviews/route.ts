/**
 * GET  /api/tools/rentals/ai-reviews       — list flagged AI reviews
 * POST /api/tools/rentals/ai-reviews       — trigger AI review (small batch)
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { prisma } from "@/lib/prisma";
import { runAiReview } from "@/lib/rentals/ai-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET — return flagged AI reviews with listing details.
 * Query params: flaggedOnly (default true), limit, page
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const url = new URL(req.url);
    const flaggedOnly = url.searchParams.get("flaggedOnly") !== "false";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    const where = flaggedOnly ? { flagged: true } : {};

    const [reviews, total] = await Promise.all([
      prisma.rentalAiReview.findMany({
        where,
        orderBy: { reviewedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              canonicalUrl: true,
              propertyType: true,
              priceMonthlyUsd: true,
              district: true,
              isActive: true,
              source: true,
            },
          },
        },
      }),
      prisma.rentalAiReview.count({ where }),
    ]);

    return NextResponse.json({
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST — trigger a small AI review batch from the dashboard.
 * Body: { limit?: number, source?: string }
 * Max 50 listings per web request to avoid timeout.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, body.limit || 20));
    const source = body.source || undefined;

    const logs: string[] = [];
    const result = await runAiReview({
      dryRun: false,
      unreviewed: true,
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
