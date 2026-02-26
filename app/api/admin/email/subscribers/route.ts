import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/email/subscribers
 * Fetch subscriber stats and list.
 */
export async function GET() {
  try {
    await requireAdmin();

    const [totalUsers, optedIn, unsubscribed, verified] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { emailMarketingOptIn: true, status: "ACTIVE" } }),
      prisma.user.count({ where: { emailUnsubscribed: true, status: "ACTIVE" } }),
      prisma.user.count({ where: { emailVerified: { not: null }, status: "ACTIVE" } }),
    ]);

    const eligible = await prisma.user.count({
      where: {
        emailMarketingOptIn: true,
        emailUnsubscribed: false,
        emailVerified: { not: null },
        status: "ACTIVE",
      },
    });

    const recentLogs = await prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { email: true, name: true } },
        campaign: { select: { subject: true } },
      },
    });

    return NextResponse.json({
      stats: { totalUsers, optedIn, unsubscribed, verified, eligible },
      recentLogs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
