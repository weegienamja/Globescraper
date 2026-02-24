import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * Log a security event for a user.
 */
export async function logSecurityEvent(
  userId: string,
  eventType: string,
  opts?: { ipAddress?: string; userAgent?: string },
) {
  try {
    let ip = opts?.ipAddress;
    let ua = opts?.userAgent;

    if (!ip || !ua) {
      try {
        const hdrs = await headers();
        if (!ip) {
          ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || undefined;
        }
        if (!ua) {
          ua = hdrs.get("user-agent") || undefined;
        }
      } catch {
        // headers() may not be available in all contexts
      }
    }

    await prisma.userSecurityEvent.create({
      data: {
        userId,
        eventType,
        ipAddress: ip?.substring(0, 45) || null,
        userAgent: ua?.substring(0, 500) || null,
      },
    });
  } catch {
    // Non-critical — don't break auth flow
  }
}

/**
 * Check if an IP is blocked.
 * Returns true if the IP matches any active blocked entry.
 * Supports exact IP match (not full CIDR parsing for simplicity).
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip) return false;

  const now = new Date();
  const blocked = await prisma.blockedIp.findFirst({
    where: {
      ipCidr: ip,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
  });

  return !!blocked;
}
