import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages",
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/messages");

  const params = await searchParams;
  const toUserId = typeof params.to === "string" ? params.to : null;
  const userId = session.user.id;

  // If ?to=userId, find or create conversation and redirect
  if (toUserId && toUserId !== userId) {
    // Check connection in new table, then fall back to legacy
    const connected =
      (await prisma.connection.findFirst({
        where: {
          status: "ACCEPTED",
          userLowId: userId < toUserId ? userId : toUserId,
          userHighId: userId < toUserId ? toUserId : userId,
        },
      })) ??
      (await prisma.connectionRequest.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { fromUserId: userId, toUserId: toUserId },
            { fromUserId: toUserId, toUserId: userId },
          ],
        },
      }));

    if (!connected) {
      return (
        <div className="chat-container">
          <div className="chat-card" style={{ padding: "48px 24px" }}>
            <div className="chat-empty">
              <div className="chat-empty__icon">🔒</div>
              <p className="chat-empty__title">Not connected</p>
              <p className="chat-empty__text">
                You must be connected with this user to send messages.
              </p>
              <Link href="/dashboard/requests" className="btn btn--outline btn--sm" style={{ marginTop: 12 }}>
                View connections
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Find existing conversation
    const existingConv = await prisma.conversation.findFirst({
      where: {
        type: "DM",
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: toUserId } } },
        ],
      },
      include: {
        participants: true,
      },
    });

    if (existingConv && existingConv.participants.length === 2) {
      redirect(`/dashboard/messages/${existingConv.id}`);
    }

    // Create new conversation
    const newConv = await prisma.conversation.create({
      data: {
        type: "DM",
        participants: {
          create: [{ userId }, { userId: toUserId }],
        },
      },
    });
    redirect(`/dashboard/messages/${newConv.id}`);
  }

  // ── Fetch conversations & connections in parallel ─────────
  const [participations, acceptedConnections] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
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
              orderBy: { createdAt: "desc" },
              take: 1,
              where: { deletedAt: null },
              select: { body: true, senderId: true, createdAt: true },
            },
          },
        },
      },
    }),
    // Accepted connections from legacy table for the sidebar
    prisma.connectionRequest.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Sort conversations by last message date
  const conversations = participations
    .map((p) => {
      const others = p.conversation.participants
        .filter((pp) => pp.userId !== userId)
        .map((pp) => pp.user);
      const lastMsg = p.conversation.messages[0] ?? null;
      const hasUnread = lastMsg
        ? !p.lastReadAt || new Date(lastMsg.createdAt) > new Date(p.lastReadAt)
        : false;

      return {
        id: p.conversation.id,
        others,
        lastMsg,
        hasUnread,
        lastActivity: lastMsg?.createdAt ?? p.conversation.createdAt,
      };
    })
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  // Build connections list — exclude ones I already have conversations with
  const conversationUserIds = new Set(
    conversations.flatMap((c) => c.others.map((o) => o.id)),
  );

  const connections = acceptedConnections
    .map((conn) => {
      const other = conn.fromUserId === userId ? conn.toUser : conn.fromUser;
      return other;
    })
    .filter((u) => !conversationUserIds.has(u.id));

  function timeAgo(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }

  return (
    <div className="chat-container">
      <div className="chat-inbox">
        {/* ── Sidebar: conversations + connections ── */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar__header">
            <div className="chat-sidebar__title-row">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <h1 className="chat-sidebar__title">Messages</h1>
            </div>
          </div>

          <div className="chat-sidebar__list">
            {conversations.length === 0 && connections.length === 0 ? (
              <div className="chat-sidebar__empty">
                <p>No conversations yet.</p>
                <Link href="/community" className="btn btn--primary btn--sm">Browse community</Link>
              </div>
            ) : (
              <>
                {conversations.map((conv) => {
                  const other = conv.others[0];
                  if (!other) return null;
                  const displayName = other.profile?.displayName ?? other.name ?? "Unknown";
                  return (
                    <Link
                      key={conv.id}
                      href={`/dashboard/messages/${conv.id}`}
                      className={`chat-sidebar__item ${conv.hasUnread ? "chat-sidebar__item--unread" : ""}`}
                    >
                      <div className="chat-sidebar__item-avatar">
                        {other.profile?.avatarUrl ? (
                          <Image src={other.profile.avatarUrl} alt={displayName} width={44} height={44} className="chat-sidebar__avatar-img" />
                        ) : (
                          <div className="chat-sidebar__avatar-ph">
                            {(displayName[0] ?? "?").toUpperCase()}
                          </div>
                        )}
                        {conv.hasUnread && <span className="chat-sidebar__unread-dot" />}
                      </div>
                      <div className="chat-sidebar__item-body">
                        <div className="chat-sidebar__item-top">
                          <span className="chat-sidebar__item-name">{displayName}</span>
                          {conv.lastMsg && (
                            <span className="chat-sidebar__item-time">{timeAgo(conv.lastMsg.createdAt)}</span>
                          )}
                        </div>
                        {conv.lastMsg && (
                          <p className="chat-sidebar__item-preview">
                            {conv.lastMsg.senderId === userId ? "You: " : ""}
                            {conv.lastMsg.body.length > 60 ? conv.lastMsg.body.slice(0, 60) + "…" : conv.lastMsg.body}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}

                {connections.length > 0 && (
                  <>
                    <div className="chat-sidebar__section-label">Start a conversation</div>
                    {connections.map((user) => {
                      const displayName = user.profile?.displayName ?? user.name ?? "Unknown";
                      return (
                        <Link
                          key={user.id}
                          href={`/dashboard/messages?to=${user.id}`}
                          className="chat-sidebar__item"
                        >
                          <div className="chat-sidebar__item-avatar">
                            {user.profile?.avatarUrl ? (
                              <Image src={user.profile.avatarUrl} alt={displayName} width={44} height={44} className="chat-sidebar__avatar-img" />
                            ) : (
                              <div className="chat-sidebar__avatar-ph">
                                {(displayName[0] ?? "?").toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="chat-sidebar__item-body">
                            <span className="chat-sidebar__item-name">{displayName}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ── Main area: placeholder ── */}
        <main className="chat-inbox__main">
          <div className="chat-empty">
            <div className="chat-empty__icon">💬</div>
            <p className="chat-empty__title">Your messages</p>
            <p className="chat-empty__text">
              {conversations.length > 0
                ? "Select a conversation to start chatting."
                : connections.length > 0
                  ? "Pick a connection to start a conversation."
                  : <>Connect with teachers in the <Link href="/community">community</Link> first.</>}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
