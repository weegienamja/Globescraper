import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { areConnected, isBlocked } from "@/lib/connections";

/**
 * GET /api/messages — list conversations for the current user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { deletedAt: null },
            select: { id: true, body: true, senderId: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { conversation: { createdAt: "desc" } },
  });

  const conversations = participations.map((p) => {
    const otherParticipants = p.conversation.participants
      .filter((pp) => pp.userId !== userId)
      .map((pp) => pp.user);
    const lastMessage = p.conversation.messages[0] ?? null;

    // Compute unread count
    const myLastRead = p.lastReadAt;

    return {
      id: p.conversation.id,
      type: p.conversation.type,
      otherUsers: otherParticipants,
      lastMessage,
      lastReadAt: myLastRead,
      hasUnread: lastMessage ? (!myLastRead || new Date(lastMessage.createdAt) > new Date(myLastRead)) : false,
    };
  });

  return NextResponse.json({ conversations });
}
