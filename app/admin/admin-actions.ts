"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type ActionResult = { ok: true } | { error: string };

export async function adminDisableUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { disabled: true },
  });

  // Set profile to private
  await prisma.profile.updateMany({
    where: { userId },
    data: { visibility: "PRIVATE" },
  });

  // Audit log
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "DISABLE_USER",
      targetType: "USER",
      targetId: userId,
      metadata: JSON.stringify({ action: "disabled user and set profile to PRIVATE" }),
    },
  });

  return { ok: true };
}

export async function adminCancelMeetup(meetupId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { status: "CANCELLED" },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "CANCEL_MEETUP",
      targetType: "MEETUP",
      targetId: meetupId,
      metadata: JSON.stringify({ action: "admin cancelled meetup" }),
    },
  });

  return { ok: true };
}

export async function adminDismissReport(reportId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "DISMISS_REPORT",
      targetType: "REPORT",
      targetId: reportId,
      metadata: JSON.stringify({ action: "admin dismissed report" }),
    },
  });

  // Delete the report
  await prisma.report.delete({ where: { id: reportId } });

  return { ok: true };
}
