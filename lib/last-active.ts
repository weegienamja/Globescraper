import { prisma } from "@/lib/prisma";

const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Update a user's lastActiveAt timestamp, throttled to once per 15 minutes
 * to avoid excessive writes. Fire-and-forget - never throws.
 */
export async function touchLastActive(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true },
    });

    if (!user) return;

    const lastActive = user.lastActiveAt?.getTime() ?? 0;
    if (Date.now() - lastActive < THROTTLE_MS) return;

    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  } catch {
    // Non-critical - silently ignore failures
  }
}
