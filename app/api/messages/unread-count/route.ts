import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/messages/unread-count — total unread message count across all conversations.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ count: 0 });

  const userId = session.user.id;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });

  if (participations.length === 0)
    return NextResponse.json({ count: 0 });

  let total = 0;
  for (const p of participations) {
    const where: Record<string, unknown> = {
      conversationId: p.conversationId,
      deletedAt: null,
      senderId: { not: userId },
    };
    if (p.lastReadAt) {
      where.createdAt = { gt: p.lastReadAt };
    }
    const count = await prisma.message.count({ where });
    total += count;
  }

  return NextResponse.json({ count: total });
}
