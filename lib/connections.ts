import { prisma } from "@/lib/prisma";

/**
 * Canonical connection helpers.
 *
 * Connections are stored with (userLowId, userHighId) where userLowId < userHighId
 * to enforce a single row per user pair.
 */

export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Check if two users are connected (accepted status).
 */
export async function areConnected(userA: string, userB: string): Promise<boolean> {
  const [low, high] = canonicalPair(userA, userB);
  const conn = await prisma.connection.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    select: { status: true },
  });
  return conn?.status === "ACCEPTED";
}

/**
 * Check if a block exists between two users (either direction).
 */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
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

/**
 * Check if a user is allowed to interact (not banned/deleted/disabled).
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true, status: true, deletedAt: true },
  });
  if (!user) return false;
  if (user.disabled) return false;
  if (user.status === "BANNED" || user.status === "DELETED") return false;
  if (user.deletedAt) return false;
  return true;
}
