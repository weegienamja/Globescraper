import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/types/next-auth";

// -- Role constants --

/** Roles that can use community social features (connect, message, meetups). */
export const SOCIAL_ROLES: AppRole[] = ["TEACHER", "STUDENT"];

/** Roles visible in the community directory. */
export const COMMUNITY_VISIBLE_ROLES: AppRole[] = ["TEACHER", "STUDENT"];

/** Roles that must complete onboarding before accessing community. */
export const ONBOARDABLE_ROLES: AppRole[] = ["TEACHER", "STUDENT", "RECRUITER"];

/**
 * Require the current session user to have one of the given roles.
 * Redirects to the appropriate page if unauthorized.
 */
export async function requireRole(roles: AppRole[]) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check ban/suspension first
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, disabled: true, role: true },
  });

  if (!user || user.disabled) {
    redirect("/account-locked");
  }
  if (user.status === "BANNED" || user.status === "SUSPENDED") {
    redirect("/account-locked");
  }

  if (!roles.includes(user.role as AppRole)) {
    redirect("/");
  }

  return { ...session, dbRole: user.role as AppRole };
}

/**
 * Require that the current user is not banned or suspended.
 * Returns the session if the user is active.
 */
export async function requireNotBanned() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, disabled: true, deletedAt: true },
  });

  if (!user || user.disabled || user.deletedAt) {
    redirect("/account-locked");
  }
  if (user.status === "BANNED" || user.status === "SUSPENDED" || user.status === "DELETED") {
    redirect("/account-locked");
  }

  return session;
}

/**
 * Check if a role can use social features (connect, message, meetups).
 */
export function canUseSocialFeatures(role: string): boolean {
  return SOCIAL_ROLES.includes(role as AppRole);
}

/**
 * Check if a role is a recruiter.
 */
export function isRecruiter(role: string): boolean {
  return role === "RECRUITER";
}

/**
 * Check if a user needs onboarding (role is still USER - no role selected yet).
 */
export function needsOnboarding(role: string): boolean {
  return role === "USER";
}

/**
 * Log an admin moderation action to the audit log.
 */
export async function logAdminAction(
  adminUserId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  opts?: {
    targetUserId?: string;
    metadata?: Record<string, unknown>;
    before?: unknown;
    after?: unknown;
  },
) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      actionType,
      targetType,
      targetId,
      targetUserId: opts?.targetUserId ?? null,
      metadata: opts?.metadata ? JSON.stringify(opts.metadata) : null,
      beforeJson: opts?.before ? JSON.stringify(opts.before) : null,
      afterJson: opts?.after ? JSON.stringify(opts.after) : null,
    },
  });
}
