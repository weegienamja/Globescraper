import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/email/campaigns/[id]
 * Fetch a single campaign with log stats.
 *
 * PATCH /api/admin/email/campaigns/[id]
 * Update campaign draft fields.
 *
 * DELETE /api/admin/email/campaigns/[id]
 * Delete a campaign draft.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Only DRAFT or SCHEDULED campaigns can be edited." },
        { status: 400 },
      );
    }

    const { subject, previewText, htmlContent, textContent, segmentJson, scheduledAt } =
      await req.json();

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        ...(subject !== undefined && { subject }),
        ...(previewText !== undefined && { previewText }),
        ...(htmlContent !== undefined && { htmlContent }),
        ...(textContent !== undefined && { textContent }),
        ...(segmentJson !== undefined && { segmentJson }),
        ...(scheduledAt !== undefined && {
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          status: scheduledAt ? "SCHEDULED" : "DRAFT",
        }),
      },
    });

    return NextResponse.json({ ok: true, campaign: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (campaign.status === "SENDING" || campaign.status === "SENT") {
      return NextResponse.json(
        { error: "Cannot delete a campaign that is sending or already sent." },
        { status: 400 },
      );
    }

    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
