import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { MessageInput } from "./message-input";
import { ChatScrollAnchor } from "./chat-scroll-anchor";

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
              lastActiveAt: true,
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

  const otherName = otherUser?.profile?.displayName ?? otherUser?.name ?? "Unknown";
  const otherAvatar = otherUser?.profile?.avatarUrl ?? null;
  const otherInitial = (otherName[0] ?? "?").toUpperCase();

  // Online status: active within last 5 minutes
  const ONLINE_THRESHOLD = 5 * 60 * 1000;
  const otherLastActive = otherUser?.lastActiveAt ? new Date(otherUser.lastActiveAt).getTime() : 0;
  const isOnline = Date.now() - otherLastActive < ONLINE_THRESHOLD;

  function lastSeenText(lastActive: Date | null | undefined): string {
    if (!lastActive) return "Offline";
    const diff = Date.now() - new Date(lastActive).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Active just now";
    if (mins < 60) return `Active ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Active yesterday";
    return `Active ${days}d ago`;
  }

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

  // Group messages by date, then sub-group consecutive same-sender
  type Msg = (typeof conversation.messages)[number];
  type MessageGroup = { senderId: string; messages: Msg[] };
  type DateGroup = { date: string; groups: MessageGroup[] };

  const dateGroups: DateGroup[] = [];
  for (const msg of conversation.messages) {
    const dateStr = fmtDate(msg.createdAt);
    let dg = dateGroups.find((g) => g.date === dateStr);
    if (!dg) {
      dg = { date: dateStr, groups: [] };
      dateGroups.push(dg);
    }
    const lastGroup = dg.groups[dg.groups.length - 1];
    if (lastGroup && lastGroup.senderId === msg.senderId) {
      lastGroup.messages.push(msg);
    } else {
      dg.groups.push({ senderId: msg.senderId, messages: [msg] });
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-card">
        {/* ── Header ── */}
        <div className="chat-header">
          <div className="chat-header__left">
            <Link href="/dashboard/messages" className="chat-header__back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              <span className="chat-header__back-label">Messages</span>
            </Link>
          </div>
          <div className="chat-header__center">
            {otherAvatar ? (
              <Image src={otherAvatar} alt={otherName} width={44} height={44} className="chat-header__avatar" />
            ) : (
              <div className="chat-header__avatar-placeholder">{otherInitial}</div>
            )}
            <div className="chat-header__info">
              <Link href={`/community/${otherUser?.id}`} className="chat-header__name">
                {otherName}
              </Link>
              <span className="chat-header__status">
                <span className={`chat-header__status-dot ${isOnline ? "chat-header__status-dot--online" : "chat-header__status-dot--offline"}`} />
                {isOnline ? "Online" : lastSeenText(otherUser?.lastActiveAt)}
              </span>
            </div>
          </div>
          <div className="chat-header__right">
            <Link href={`/community/${otherUser?.id}`} className="chat-header__icon-btn" title="View profile">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </Link>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="chat-messages">
          {conversation.messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty__icon">💬</div>
              <p className="chat-empty__title">No messages yet</p>
              <p className="chat-empty__text">Say hello to {otherName}!</p>
            </div>
          ) : (
            dateGroups.map((dg) => (
              <div key={dg.date}>
                <div className="chat-divider">
                  <span className="chat-divider__line" />
                  <span className="chat-divider__pill">{dg.date}</span>
                  <span className="chat-divider__line" />
                </div>
                {dg.groups.map((group, gi) => {
                  const isMine = group.senderId === userId;
                  return (
                    <div key={gi} className={`chat-group ${isMine ? "chat-group--mine" : "chat-group--theirs"}`}>
                      {!isMine && (
                        <div className="chat-group__avatar-col">
                          {otherAvatar ? (
                            <Image src={otherAvatar} alt={otherName} width={32} height={32} className="chat-group__avatar" />
                          ) : (
                            <div className="chat-group__avatar-ph">{otherInitial}</div>
                          )}
                        </div>
                      )}
                      <div className="chat-group__bubbles">
                        {group.messages.map((msg, mi) => (
                          <div
                            key={msg.id}
                            className={`chat-bubble ${isMine ? "chat-bubble--mine" : "chat-bubble--theirs"} chat-bubble--anim`}
                            style={{ animationDelay: `${mi * 30}ms` }}
                          >
                            <span className="chat-bubble__body">{msg.body}</span>
                            <span className="chat-bubble__meta">
                              {fmtTime(msg.createdAt)}
                              {isMine && (
                                <svg className="chat-bubble__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <ChatScrollAnchor />
        </div>

        {/* ── Composer ── */}
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  );
}
