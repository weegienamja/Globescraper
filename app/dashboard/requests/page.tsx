import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { RequestActions } from "./request-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connection Requests",
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/requests");

  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : "received";
  const userId = session.user.id;

  const received = await prisma.connectionRequest.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: {
      fromUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true, currentCountry: true, currentCity: true } },
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
          profile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const connections = await prisma.connectionRequest.findMany({
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
          profile: { select: { displayName: true } },
        },
      },
      toUser: {
        select: {
          id: true,
          name: true,
          profile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

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

  return (
    <div className="requests-page">
      <h1>Connection Requests</h1>

      {/* Tabs */}
      <div className="tabs">
        <Link
          href="/dashboard/requests?tab=received"
          className={`tabs__tab ${tab === "received" ? "tabs__tab--active" : ""}`}
        >
          Received ({received.length})
        </Link>
        <Link
          href="/dashboard/requests?tab=sent"
          className={`tabs__tab ${tab === "sent" ? "tabs__tab--active" : ""}`}
        >
          Sent ({sent.length})
        </Link>
        <Link
          href="/dashboard/requests?tab=connections"
          className={`tabs__tab ${tab === "connections" ? "tabs__tab--active" : ""}`}
        >
          Connections ({connections.length})
        </Link>
      </div>

      {/* Received */}
      {tab === "received" && (
        <div className="requests-list">
          {received.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📬</div>
              <p className="empty-state__title">No pending requests</p>
              <p className="empty-state__text">
                When someone wants to connect, their request will appear here.
              </p>
            </div>
          ) : (
            received.map((req) => (
              <div key={req.id} className="request-card">
                <div className="request-card__info">
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
                Requests you send will appear here.
              </p>
            </div>
          ) : (
            sent.map((req) => (
              <div key={req.id} className="request-card">
                <div className="request-card__info">
                  <Link
                    href={`/community/${req.toUser.id}`}
                    className="request-card__name"
                  >
                    {req.toUser.profile?.displayName ?? req.toUser.name ?? "Unknown"}
                  </Link>
                  <span className="request-card__date">{fmtDate(req.createdAt)}</span>
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

      {/* Connections */}
      {tab === "connections" && (
        <div className="requests-list">
          {connections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🤝</div>
              <p className="empty-state__title">No connections yet</p>
              <p className="empty-state__text">
                <Link href="/community">Browse the community</Link> to find and connect with other teachers.
              </p>
            </div>
          ) : (
            connections.map((conn) => {
              const other =
                conn.fromUserId === userId ? conn.toUser : conn.fromUser;
              return (
                <div key={conn.id} className="request-card">
                  <div className="request-card__info">
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
                  <span className="badge badge--ok">✓ Connected</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
