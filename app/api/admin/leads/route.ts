import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const;

const patchSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(LEAD_STATUSES).optional(),
  adminNotes: z.string().max(5000).optional(),
});

export async function PATCH(request: Request) {
  // ── Auth guard ────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // ── Parse & validate ──────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { leadId, status, adminNotes } = parsed.data;

  if (status === undefined && adminNotes === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // ── Fetch current lead for audit diff ─────────────────────
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // ── Update lead ───────────────────────────────────────────
  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
  });

  // ── Audit log ─────────────────────────────────────────────
  const auditEntries = [];

  if (status !== undefined && status !== existing.status) {
    auditEntries.push({
      adminUserId: session.user.id,
      actionType: "lead_status_changed",
      targetType: "Lead",
      targetId: leadId,
      metadata: JSON.stringify({
        from: existing.status,
        to: status,
      }),
    });
  }

  if (adminNotes !== undefined && adminNotes !== existing.adminNotes) {
    auditEntries.push({
      adminUserId: session.user.id,
      actionType: "lead_notes_updated",
      targetType: "Lead",
      targetId: leadId,
      metadata: JSON.stringify({
        previousLength: existing.adminNotes?.length ?? 0,
        newLength: adminNotes.length,
      }),
    });
  }

  if (auditEntries.length > 0) {
    await prisma.adminAuditLog.createMany({ data: auditEntries });
  }

  return NextResponse.json({
    ok: true,
    status: updated.status,
    adminNotes: updated.adminNotes,
  });
}
