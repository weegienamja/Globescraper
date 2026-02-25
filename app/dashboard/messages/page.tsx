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
        <div className="messages-page">
          <h1>Messages</h1>
          <div className="empty-state">
            <div className="empty-state__icon">🔒</div>
            <p className="empty-state__title">Not connected</p>
            <p className="empty-state__text">
              You must be connected with this user to send messages.
            </p>
            <Link href="/dashboard/requests" className="btn btn--outline btn--sm">
              View connections
            </Link>
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
    <div className="messages-layout">
      {/* ── Left sidebar: connections ── */}
      <aside className="messages-sidebar">
        <h2 className="messages-sidebar__title">Connections</h2>
        {connections.length === 0 && conversations.length === 0 ? (
          <p className="messages-sidebar__empty">
            No connections yet.{" "}
            <Link href="/community">Browse community</Link>
          </p>
        ) : connections.length === 0 ? (
          <p className="messages-sidebar__empty">All connections have conversations.</p>
        ) : (
          <div className="messages-sidebar__list">
            {connections.map((user) => (
              <Link
                key={user.id}
                href={`/dashboard/messages?to=${user.id}`}
                className="messages-sidebar__item"
              >
                {user.profile?.avatarUrl ? (
                  <Image
                    src={user.profile.avatarUrl}
                    alt={user.profile.displayName ?? user.name ?? ""}
                    width={36}
                    height={36}
                    className="messages-sidebar__avatar-img"
                  />
                ) : (
                  <div className="messages-sidebar__avatar-placeholder">
                    {(user.profile?.displayName?.[0] ?? user.name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <span className="messages-sidebar__name">
                  {user.profile?.displayName ?? user.name ?? "Unknown"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </aside>

      {/* ── Main: conversations ── */}
      <main className="messages-main">
        <h1>Messages</h1>

        {conversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💬</div>
            <p className="empty-state__title">No messages yet</p>
            <p className="empty-state__text">
              {connections.length > 0
                ? "Select a connection from the sidebar to start a conversation."
                : <>Connect with other teachers in the <Link href="/community">community</Link>, then come back to message them.</>}
            </p>
          </div>
        ) : (
          <div className="conversations-list">
            {conversations.map((conv) => {
              const other = conv.others[0];
              if (!other) return null;
              return (
                <Link
                  key={conv.id}
                  href={`/dashboard/messages/${conv.id}`}
                  className={`conversation-card ${conv.hasUnread ? "conversation-card--unread" : ""}`}
                >
                  <div className="conversation-card__avatar">
                    {other.profile?.avatarUrl ? (
                      <Image
                        src={other.profile.avatarUrl}
                        alt={other.profile?.displayName ?? other.name ?? ""}
                        width={44}
                        height={44}
                        className="conversation-card__avatar-img"
                      />
                    ) : (
                      <div className="conversation-card__avatar-placeholder">
                        {(other.profile?.displayName?.[0] ?? other.name?.[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    {conv.hasUnread && <span className="conversation-card__unread-dot" />}
                  </div>
                  <div className="conversation-card__content">
                    <div className="conversation-card__header">
                      <span className="conversation-card__name">
                        {other.profile?.displayName ?? other.name ?? "Unknown"}
                      </span>
                      {conv.lastMsg && (
                        <span className="conversation-card__time">
                          {timeAgo(conv.lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    {conv.lastMsg && (
                      <p className="conversation-card__preview">
                        {conv.lastMsg.senderId === userId ? "You: " : ""}
                        {conv.lastMsg.body.length > 80
                          ? conv.lastMsg.body.slice(0, 80) + "…"
                          : conv.lastMsg.body}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
