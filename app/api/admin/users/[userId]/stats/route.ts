import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/users/[userId]/stats — get stats for a specific user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      disabled: true,
      deletedAt: true,
      lastLoginAt: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          bio: true,
          avatarUrl: true,
          currentCountry: true,
          currentCity: true,
          visibility: true,
          targetCountries: { select: { country: true } },
        },
      },
    },
  });

  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [connectionCount, messageCount, securityEvents] = await Promise.all([
    prisma.connection.count({
      where: {
        status: "ACCEPTED",
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
    }),
    prisma.message.count({
      where: { senderId: userId, deletedAt: null },
    }),
    prisma.userSecurityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, eventType: true, ipAddress: true, userAgent: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    user,
    stats: {
      connectionCount,
      messageCount,
      securityEvents,
    },
  });
}
