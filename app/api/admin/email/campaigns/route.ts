import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/email/campaigns
 * Create a new campaign draft.
 *
 * GET /api/admin/email/campaigns
 * List all campaigns.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { subject, previewText, htmlContent, textContent, segmentJson, scheduledAt } =
      await req.json();

    if (!subject || !htmlContent) {
      return NextResponse.json(
        { error: "subject and htmlContent are required." },
        { status: 400 },
      );
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        subject,
        previewText: previewText || null,
        htmlContent,
        textContent: textContent || null,
        segmentJson: segmentJson || undefined,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();

    const campaigns = await prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ campaigns });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
