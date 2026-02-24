"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  communityProfileSchema,
  connectionRequestSchema,
  reportSchema,
} from "@/lib/validations/community";
import { getConnectionRatelimit } from "@/lib/rate-limit";

type ActionResult = { ok: true } | { error: string };

// ── helpers ──────────────────────────────────────────────────

async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerUserId: userA, blockedUserId: userB },
        { blockerUserId: userB, blockedUserId: userA },
      ],
    },
  });
  return !!block;
}

// ── Update community profile ─────────────────────────────────

export async function updateCommunityProfile(
  data: unknown,
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const parsed = communityProfileSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const {
    displayName,
    bio,
    currentCountry,
    currentCity,
    targetCountries,
    visibility,
    meetupCoffee,
    meetupCityTour,
    meetupJobAdvice,
    meetupStudyGroup,
    meetupLanguageExchange,
  } = parsed.data;

  // Map community country names to TargetCountry enum values
  const countryMap: Record<string, string> = {
    Vietnam: "VIETNAM",
    Thailand: "THAILAND",
    Cambodia: "CAMBODIA",
    Philippines: "PHILIPPINES",
  };

  const enumCountries = targetCountries
    .map((c) => countryMap[c])
    .filter(Boolean);

  const existing = await prisma.profile.findUnique({
    where: { userId },
  });

  if (!existing) {
    // Create a new profile with community fields + defaults for teaching fields
    await prisma.profile.create({
      data: {
        userId,
        displayName,
        bio: bio || null,
        currentCountry: currentCountry || null,
        currentCity: currentCity || null,
        visibility: visibility as "PRIVATE" | "MEMBERS_ONLY" | "PUBLIC",
        meetupCoffee,
        meetupCityTour,
        meetupJobAdvice,
        meetupStudyGroup,
        meetupLanguageExchange,
        targetCountries: {
          create: enumCountries.map((country) => ({ country: country as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA" })),
        },
      },
    });
  } else {
    await prisma.profile.update({
      where: { userId },
      data: {
        displayName,
        bio: bio || null,
        currentCountry: currentCountry || null,
        currentCity: currentCity || null,
        visibility: visibility as "PRIVATE" | "MEMBERS_ONLY" | "PUBLIC",
        meetupCoffee,
        meetupCityTour,
        meetupJobAdvice,
        meetupStudyGroup,
        meetupLanguageExchange,
        targetCountries: {
          deleteMany: {},
          create: enumCountries.map((country) => ({ country: country as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA" })),
        },
      },
    });
  }

  return { ok: true };
}

// ── Send connection request ──────────────────────────────────

export async function sendConnectionRequest(
  data: unknown,
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const parsed = connectionRequestSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { toUserId, message } = parsed.data;

  if (toUserId === userId) return { error: "Cannot connect with yourself" };

  // Rate limit
  const limiter = getConnectionRatelimit();
  if (limiter) {
    const { success } = await limiter.limit(userId);
    if (!success)
      return { error: "Too many connection requests today. Try again tomorrow." };
  }

  // Check blocks
  if (await isBlocked(userId, toUserId))
    return { error: "Cannot send request to this user" };

  // Check target user exists and is not disabled
  const targetUser = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { disabled: true },
  });
  if (!targetUser || targetUser.disabled)
    return { error: "User not found" };

  // Check for existing request in either direction
  const existing = await prisma.connectionRequest.findFirst({
    where: {
      OR: [
        { fromUserId: userId, toUserId },
        { fromUserId: toUserId, toUserId: userId },
      ],
    },
  });
  if (existing) {
    if (existing.status === "BLOCKED")
      return { error: "Cannot send request to this user" };
    if (existing.status === "PENDING")
      return { error: "A request is already pending" };
    if (existing.status === "ACCEPTED")
      return { error: "You are already connected" };
    // DECLINED — allow re-request by updating
    if (existing.fromUserId === userId) {
      await prisma.connectionRequest.update({
        where: { id: existing.id },
        data: { status: "PENDING", message: message || null },
      });
      return { ok: true };
    }
  }

  await prisma.connectionRequest.create({
    data: {
      fromUserId: userId,
      toUserId,
      message: message || null,
    },
  });

  return { ok: true };
}

// ── Respond to connection request ────────────────────────────

export async function respondToConnection(
  requestId: string,
  action: "ACCEPTED" | "DECLINED" | "BLOCKED",
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const request = await prisma.connectionRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.toUserId !== userId)
    return { error: "Request not found" };

  if (request.status !== "PENDING")
    return { error: "Request already handled" };

  await prisma.connectionRequest.update({
    where: { id: requestId },
    data: { status: action },
  });

  // If blocked, also create a Block record
  if (action === "BLOCKED") {
    await prisma.block.upsert({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: userId,
          blockedUserId: request.fromUserId,
        },
      },
      create: { blockerUserId: userId, blockedUserId: request.fromUserId },
      update: {},
    });
  }

  return { ok: true };
}

// ── Block user ───────────────────────────────────────────────

export async function blockUser(targetUserId: string): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  if (targetUserId === userId) return { error: "Cannot block yourself" };

  await prisma.block.upsert({
    where: {
      blockerUserId_blockedUserId: {
        blockerUserId: userId,
        blockedUserId: targetUserId,
      },
    },
    create: { blockerUserId: userId, blockedUserId: targetUserId },
    update: {},
  });

  // Also update any pending connection requests
  await prisma.connectionRequest.updateMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: targetUserId },
        { fromUserId: targetUserId, toUserId: userId },
      ],
      status: "PENDING",
    },
    data: { status: "BLOCKED" },
  });

  return { ok: true };
}

// ── Unblock user ─────────────────────────────────────────────

export async function unblockUser(
  targetUserId: string,
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  await prisma.block.deleteMany({
    where: { blockerUserId: userId, blockedUserId: targetUserId },
  });

  return { ok: true };
}

// ── Submit report ────────────────────────────────────────────

export async function submitReport(data: unknown): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const parsed = reportSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { targetType, targetId, reason, details } = parsed.data;

  // Prevent duplicate reports
  const existing = await prisma.report.findFirst({
    where: {
      reporterUserId: userId,
      targetType: targetType as "USER" | "MEETUP",
      targetId,
    },
  });
  if (existing) return { error: "You have already reported this" };

  await prisma.report.create({
    data: {
      reporterUserId: userId,
      targetType: targetType as "USER" | "MEETUP",
      targetId,
      reason: reason as "SPAM" | "HARASSMENT" | "SCAM" | "OTHER",
      details: details || null,
    },
  });

  return { ok: true };
}
