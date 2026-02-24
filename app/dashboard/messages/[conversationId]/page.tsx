import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { MessageInput } from "./message-input";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Conversation" };
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/messages");

  const { conversationId } = await params;
  const userId = session.user.id;

  // Verify participation
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) notFound();

  // Get conversation with participants and messages
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          senderId: true,
          body: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  if (!conversation) notFound();

  const otherUser = conversation.participants
    .filter((p) => p.userId !== userId)
    .map((p) => p.user)[0];

  // Mark as read
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  function fmtTime(d: Date) {
    return new Date(d).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Group messages by date
  const messagesByDate: { date: string; messages: typeof conversation.messages }[] = [];
  for (const msg of conversation.messages) {
    const dateStr = fmtDate(msg.createdAt);
    const existing = messagesByDate.find((g) => g.date === dateStr);
    if (existing) {
      existing.messages.push(msg);
    } else {
      messagesByDate.push({ date: dateStr, messages: [msg] });
    }
  }

  return (
    <div className="conversation-page">
      {/* Header */}
      <div className="conversation-page__header">
        <Link href="/dashboard/messages" className="conversation-page__back">
          ← Messages
        </Link>
        <div className="conversation-page__user">
          {otherUser?.profile?.avatarUrl ? (
            <Image
              src={otherUser.profile.avatarUrl}
              alt={otherUser.profile?.displayName ?? otherUser.name ?? ""}
              width={36}
              height={36}
              className="conversation-page__avatar"
            />
          ) : (
            <div className="conversation-page__avatar-placeholder">
              {(otherUser?.profile?.displayName?.[0] ?? otherUser?.name?.[0] ?? "?").toUpperCase()}
            </div>
          )}
          <Link href={`/community/${otherUser?.id}`} className="conversation-page__name">
            {otherUser?.profile?.displayName ?? otherUser?.name ?? "Unknown"}
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="conversation-page__messages">
        {conversation.messages.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 0" }}>
            <p className="empty-state__text">
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          messagesByDate.map((group) => (
            <div key={group.date}>
              <div className="conversation-page__date-divider">
                <span>{group.date}</span>
              </div>
              {group.messages.map((msg) => {
                const isMine = msg.senderId === userId;
                return (
                  <div
                    key={msg.id}
                    className={`message-bubble ${isMine ? "message-bubble--mine" : "message-bubble--theirs"}`}
                  >
                    <div className="message-bubble__body">{msg.body}</div>
                    <span className="message-bubble__time">{fmtTime(msg.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
