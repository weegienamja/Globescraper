"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type ActionResult = { ok: true } | { error: string };

export async function adminDisableUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true, status: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { disabled: true, status: "SUSPENDED" },
  });

  // Set profile to private
  await prisma.profile.updateMany({
    where: { userId },
    data: { visibility: "PRIVATE" },
  });

  // Invalidate sessions
  await prisma.session.deleteMany({ where: { userId } });

  // Audit log
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "DISABLE_USER",
      targetType: "USER",
      targetId: userId,
      targetUserId: userId,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify({ disabled: true, status: "SUSPENDED" }),
    },
  });

  return { ok: true };
}

export async function adminBanUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true, status: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { disabled: true, status: "BANNED" },
  });

  // Set profile to private
  await prisma.profile.updateMany({
    where: { userId },
    data: { visibility: "PRIVATE" },
  });

  // Invalidate sessions
  await prisma.session.deleteMany({ where: { userId } });

  // Delete connections
  await prisma.connection.deleteMany({
    where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
  });

  // Audit log
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "BAN_USER",
      targetType: "USER",
      targetId: userId,
      targetUserId: userId,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify({ disabled: true, status: "BANNED" }),
    },
  });

  return { ok: true };
}

export async function adminReactivateUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true, status: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { disabled: false, status: "ACTIVE" },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "REACTIVATE_USER",
      targetType: "USER",
      targetId: userId,
      targetUserId: userId,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify({ disabled: false, status: "ACTIVE" }),
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
