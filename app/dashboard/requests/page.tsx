import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { RequestActions, RemoveConnectionButton, MessageButton } from "./request-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connections",
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/requests");

  const params = await searchParams;
  // Default tab is "connections" (accepted) instead of "received"
  const tab = typeof params.tab === "string" ? params.tab : "connections";
  const userId = session.user.id;

  // Fetch all data for tabs
  const received = await prisma.connectionRequest.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: {
      fromUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true, avatarUrl: true, currentCountry: true, currentCity: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sent = await prisma.connectionRequest.findMany({
    where: { fromUserId: userId },
    include: {
      toUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Fetch connections from new Connection table
  const connections = await prisma.connection.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
    include: {
      userLow: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
      userHigh: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  // Fallback: also get from legacy table if new table is empty
  type LegacyConn = {
    id: string;
    fromUserId: string;
    updatedAt: Date;
    fromUser: { id: string; name: string | null; profile: { displayName: string | null; avatarUrl: string | null } | null };
    toUser: { id: string; name: string | null; profile: { displayName: string | null; avatarUrl: string | null } | null };
  };
  let legacyConnections: LegacyConn[] = [];

  if (connections.length === 0) {
    legacyConnections = await prisma.connectionRequest.findMany({
      where: {
        OR: [
          { fromUserId: userId, status: "ACCEPTED" },
          { toUserId: userId, status: "ACCEPTED" },
        ],
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
    }) as unknown as LegacyConn[];
  }

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const statusLabels: Record<string, string> = {
    PENDING: "⏳ Pending",
    ACCEPTED: "✅ Accepted",
    DECLINED: "❌ Declined",
    BLOCKED: "🚫 Blocked",
  };

  const totalConnections = connections.length || legacyConnections.length;

  return (
    <div className="requests-page">
      <h1>Connections</h1>

      {/* Tabs — badge count only on Requests (Received) when > 0 */}
      <div className="tabs">
        <Link
          href="/dashboard/requests?tab=connections"
          className={`tabs__tab ${tab === "connections" ? "tabs__tab--active" : ""}`}
        >
          Connections ({totalConnections})
        </Link>
        <Link
          href="/dashboard/requests?tab=received"
          className={`tabs__tab ${tab === "received" ? "tabs__tab--active" : ""}`}
        >
          Requests
          {received.length > 0 && (
            <span className="tabs__badge">{received.length > 9 ? "9+" : received.length}</span>
          )}
        </Link>
        <Link
          href="/dashboard/requests?tab=sent"
          className={`tabs__tab ${tab === "sent" ? "tabs__tab--active" : ""}`}
        >
          Sent ({sent.length})
        </Link>
      </div>

      {/* Connections (default tab) */}
      {tab === "connections" && (
        <div className="requests-list">
          {totalConnections === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🤝</div>
              <p className="empty-state__title">No connections yet</p>
              <p className="empty-state__text">
                Start by browsing the <Link href="/community">community</Link> and sending
                connection requests to other teachers. Once they accept, they&apos;ll appear here.
              </p>
              <Link href="/community" className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>
                Browse community
              </Link>
            </div>
          ) : connections.length > 0 ? (
            connections.map((conn) => {
              const other = conn.userLowId === userId ? conn.userHigh : conn.userLow;
              return (
                <div key={conn.id} className="request-card">
                  <div className="request-card__info">
                    <div className="request-card__user-row">
                      {other.profile?.avatarUrl ? (
                        <Image
                          src={other.profile.avatarUrl}
                          alt={other.profile?.displayName ?? other.name ?? ""}
                          width={36}
                          height={36}
                          className="request-card__avatar"
                        />
                      ) : (
                        <div className="request-card__avatar-placeholder">
                          {(other.profile?.displayName?.[0] ?? other.name?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div>
                        <Link
                          href={`/community/${other.id}`}
                          className="request-card__name"
                        >
                          {other.profile?.displayName ?? other.name ?? "Unknown"}
                        </Link>
                        <span className="request-card__date">
                          Connected {conn.acceptedAt ? fmtDate(conn.acceptedAt) : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="request-card__actions">
                    <MessageButton userId={other.id} />
                    <RemoveConnectionButton connectionId={conn.id} />
                  </div>
                </div>
              );
            })
          ) : (
            // Legacy connections (fallback)
            legacyConnections.map((conn) => {
              const other = conn.fromUserId === userId ? conn.toUser : conn.fromUser;
              return (
                <div key={conn.id} className="request-card">
                  <div className="request-card__info">
                    <div className="request-card__user-row">
                      {other.profile?.avatarUrl ? (
                        <Image
                          src={other.profile.avatarUrl}
                          alt={other.profile?.displayName ?? other.name ?? ""}
                          width={36}
                          height={36}
                          className="request-card__avatar"
                        />
                      ) : (
                        <div className="request-card__avatar-placeholder">
                          {(other.profile?.displayName?.[0] ?? other.name?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div>
                        <Link
                          href={`/community/${other.id}`}
                          className="request-card__name"
                        >
                          {other.profile?.displayName ?? other.name ?? "Unknown"}
                        </Link>
                        <span className="request-card__date">
                          Connected {fmtDate(conn.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="badge badge--ok">✓ Connected</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Received Requests */}
      {tab === "received" && (
        <div className="requests-list">
          {received.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📬</div>
              <p className="empty-state__title">No pending requests</p>
              <p className="empty-state__text">
                When someone wants to connect with you, their request will appear here.
                In the meantime, browse the <Link href="/community">community</Link> to find other teachers.
              </p>
            </div>
          ) : (
            received.map((req) => (
              <div key={req.id} className="request-card">
                <div className="request-card__info">
                  <div className="request-card__user-row">
                    {req.fromUser.profile?.avatarUrl ? (
                      <Image
                        src={req.fromUser.profile.avatarUrl}
                        alt={req.fromUser.profile?.displayName ?? req.fromUser.name ?? ""}
                        width={36}
                        height={36}
                        className="request-card__avatar"
                      />
                    ) : (
                      <div className="request-card__avatar-placeholder">
                        {(req.fromUser.profile?.displayName?.[0] ?? req.fromUser.name?.[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <Link
                        href={`/community/${req.fromUser.id}`}
                        className="request-card__name"
                      >
                        {req.fromUser.profile?.displayName ?? req.fromUser.name ?? "Unknown"}
                      </Link>
                      {req.fromUser.profile?.currentCountry && (
                        <span className="request-card__meta">
                          📍 {[req.fromUser.profile.currentCity, req.fromUser.profile.currentCountry].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span className="request-card__date">{fmtDate(req.createdAt)}</span>
                    </div>
                  </div>
                  {req.message && (
                    <p className="request-card__message">&ldquo;{req.message}&rdquo;</p>
                  )}
                </div>
                <RequestActions requestId={req.id} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Sent */}
      {tab === "sent" && (
        <div className="requests-list">
          {sent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📤</div>
              <p className="empty-state__title">No sent requests</p>
              <p className="empty-state__text">
                Requests you send will appear here. Browse the <Link href="/community">community</Link> to find teachers to connect with.
              </p>
            </div>
          ) : (
            sent.map((req) => (
              <div key={req.id} className="request-card">
                <div className="request-card__info">
                  <div className="request-card__user-row">
                    {req.toUser.profile?.avatarUrl ? (
                      <Image
                        src={req.toUser.profile.avatarUrl}
                        alt={req.toUser.profile?.displayName ?? req.toUser.name ?? ""}
                        width={36}
                        height={36}
                        className="request-card__avatar"
                      />
                    ) : (
                      <div className="request-card__avatar-placeholder">
                        {(req.toUser.profile?.displayName?.[0] ?? req.toUser.name?.[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <Link
                        href={`/community/${req.toUser.id}`}
                        className="request-card__name"
                      >
                        {req.toUser.profile?.displayName ?? req.toUser.name ?? "Unknown"}
                      </Link>
                      <span className="request-card__date">{fmtDate(req.createdAt)}</span>
                    </div>
                  </div>
                  {req.message && (
                    <p className="request-card__message">&ldquo;{req.message}&rdquo;</p>
                  )}
                </div>
                <span className={`badge badge--${req.status.toLowerCase()}`}>
                  {statusLabels[req.status] ?? req.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
