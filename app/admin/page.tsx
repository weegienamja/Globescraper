import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import { LeadRow } from "./lead-row";
import { ReportsSection } from "./reports-section";
import { AdminUserManagement, AdminAuditLog, AdminBlockedIps } from "./admin-client-sections";
import { unstable_noStore as noStore } from "next/cache";
import { COUNTRY_LABELS } from "@/lib/validations/profile";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  noStore();
  const session = await requireAdmin();

  // ── Fetch admin user details ──────────────────────────────
  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true, createdAt: true, lastLoginAt: true },
  });

  // ── Dashboard metrics ─────────────────────────────────────
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersWeek,
    totalLeads,
    newLeadsWeek,
    totalProfiles,
    totalReports,
    openReports,
    totalMeetups,
    totalConnections,
    totalMessages,
    blockedIpCount,
    bannedUsers,
    suspendedUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.lead.count({ where: { deleted: false } }),
    prisma.lead.count({ where: { deleted: false, createdAt: { gte: sevenDaysAgo } } }),
    prisma.profile.count(),
    prisma.report.count(),
    prisma.report.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.meetup.count({ where: { status: "ACTIVE" } }),
    prisma.connectionRequest.count({ where: { status: "ACCEPTED" } }),
    prisma.message.count(),
    prisma.blockedIp.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
  ]);

  const profileRate = totalUsers > 0
    ? Math.round((totalProfiles / totalUsers) * 100)
    : 0;

  // ── Latest users ──────────────────────────────────────────
  const latestUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          targetCountries: { select: { country: true } },
        },
      },
    },
  });

  // ── Latest leads ──────────────────────────────────────────
  const latestLeads = await prisma.lead.findMany({
    where: { deleted: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // ── Formatters ────────────────────────────────────────────
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtCountries = (tc: { country: string }[]) =>
    tc.map((c) => COUNTRY_LABELS[c.country as keyof typeof COUNTRY_LABELS] ?? c.country).join(", ");

  return (
    <div className="admin">
      {/* ── Admin Header ─────────────────────────────────── */}
      <div className="admin__header">
        <div className="admin__header-info">
          <h1 className="admin__title">Admin Dashboard</h1>
          <div className="admin__meta">
            <span>{adminUser?.name || adminUser?.email}</span>
            <span className="admin__badge">ADMIN</span>
            <span className="admin__meta-sep">|</span>
            <span>{adminUser?.email}</span>
          </div>
          <div className="admin__meta admin__meta--sub">
            <span>Account created: {adminUser ? fmtDate(adminUser.createdAt) : "—"}</span>
            <span className="admin__meta-sep">|</span>
            <span>Last login: {adminUser?.lastLoginAt ? fmtDate(adminUser.lastLoginAt) : "—"}</span>
          </div>
        </div>
        <SignOutButton />
      </div>

      {/* ── AI Blog Tools ─────────────────────────────── */}
      <div className="admin__section" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/admin/content-generator" className="admin__cgen-btn" style={{ flex: 1, minWidth: "260px" }}>
          <span className="admin__cgen-btn-icon">✍️</span>
          <span className="admin__cgen-btn-text">
            <strong>AI Blog Generator</strong>
            <small>Create SEO articles for Phnom Penh and Siem Reap</small>
          </span>
        </Link>
        <Link href="/admin/blog" className="admin__cgen-btn" style={{ flex: 1, minWidth: "260px" }}>
          <span className="admin__cgen-btn-icon">🛠️</span>
          <span className="admin__cgen-btn-text">
            <strong>Blog Toolkit</strong>
            <small>SEO checker, editor, republish &amp; manage published posts</small>
          </span>
        </Link>
        <Link href="/admin/email" className="admin__cgen-btn" style={{ flex: 1, minWidth: "260px" }}>
          <span className="admin__cgen-btn-icon">📧</span>
          <span className="admin__cgen-btn-text">
            <strong>Email System</strong>
            <small>Send emails, campaigns, AI generation &amp; subscriber management</small>
          </span>
        </Link>
        <Link href="/tools" className="admin__cgen-btn admin__cgen-btn--tools" style={{ flex: 1, minWidth: "260px" }}>
          <span className="admin__cgen-btn-preview">
            <svg width="56" height="40" viewBox="0 0 56 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="56" height="40" rx="6" fill="#0f172a" />
              <rect x="4" y="4" width="14" height="8" rx="2" fill="#1e293b" />
              <rect x="20" y="4" width="14" height="8" rx="2" fill="#1e293b" />
              <rect x="36" y="4" width="16" height="8" rx="2" fill="#1e293b" />
              <rect x="4" y="14" width="24" height="3" rx="1.5" fill="#334155" />
              <rect x="4" y="19" width="18" height="3" rx="1.5" fill="#334155" />
              <rect x="4" y="24" width="21" height="3" rx="1.5" fill="#334155" />
              <rect x="4" y="29" width="16" height="3" rx="1.5" fill="#334155" />
              <rect x="36" y="14" width="16" height="18" rx="3" fill="#1e293b" />
              <circle cx="44" cy="23" r="5" fill="#60a5fa" opacity="0.3" />
              <circle cx="44" cy="23" r="3" fill="#60a5fa" opacity="0.6" />
              <rect x="4" y="34" width="48" height="2" rx="1" fill="#1e3a5f" />
            </svg>
          </span>
          <span className="admin__cgen-btn-text">
            <strong>Data Tools</strong>
            <small>Rental pipeline, scraping dashboards &amp; heatmaps</small>
          </span>
        </Link>
      </div>

      {/* ── Metrics Cards ────────────────────────────────── */}
      <div className="admin__metrics">
        <div className="admin__card">
          <div className="admin__card-value">{totalUsers}</div>
          <div className="admin__card-label">Total Users</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{newUsersWeek}</div>
          <div className="admin__card-label">New Users (7d)</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{totalLeads}</div>
          <div className="admin__card-label">Total Leads</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{newLeadsWeek}</div>
          <div className="admin__card-label">New Leads (7d)</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{profileRate}%</div>
          <div className="admin__card-label">Profile Completion</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{totalConnections}</div>
          <div className="admin__card-label">Connections</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{totalMeetups}</div>
          <div className="admin__card-label">Active Meetups</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{totalReports}</div>
          <div className="admin__card-label">Total Reports</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{openReports}</div>
          <div className="admin__card-label">Reports (7d)</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{totalMessages}</div>
          <div className="admin__card-label">Messages</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{blockedIpCount}</div>
          <div className="admin__card-label">Blocked IPs</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{bannedUsers}</div>
          <div className="admin__card-label">Banned Users</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{suspendedUsers}</div>
          <div className="admin__card-label">Suspended Users</div>
        </div>
      </div>

      {/* ── Latest Users ─────────────────────────────────── */}
      <section className="admin__section">
        <h2 className="admin__section-title">Latest Users</h2>
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Profile</th>
                <th>Target Countries</th>
              </tr>
            </thead>
            <tbody>
              {latestUsers.map((u) => (
                <tr key={u.id}>
                  <td className="admin__td-date">{fmtDate(u.createdAt)}</td>
                  <td>
                    <strong>{u.name || "—"}</strong>
                    <br />
                    <span className="admin__sub-text">{u.email}</span>
                  </td>
                  <td>
                    <span className={u.role === "ADMIN" ? "admin__badge" : "admin__badge admin__badge--user"}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.profile ? (
                      <span className="admin__badge admin__badge--ok">Complete</span>
                    ) : (
                      <span className="admin__badge admin__badge--warn">Incomplete</span>
                    )}
                  </td>
                  <td className="admin__sub-text">
                    {u.profile ? fmtCountries(u.profile.targetCountries) : "—"}
                  </td>
                </tr>
              ))}
              {latestUsers.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state__icon">👤</div>
                      <p className="empty-state__title">No users yet</p>
                      <p className="empty-state__text">New users will appear here when they sign up.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Latest Leads ─────────────────────────────────── */}
      <section className="admin__section">
        <h2 className="admin__section-title">Latest Leads</h2>
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name / Email</th>
                <th>Source</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {latestLeads.map((l) => (
                <LeadRow key={l.id} lead={l} />
              ))}
              {latestLeads.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state__icon">📋</div>
                      <p className="empty-state__title">No leads yet</p>
                      <p className="empty-state__text">Leads from the contact form will appear here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Recent Reports ───────────────────────────────── */}
      <ReportsSection />

      {/* ── User Management (Client) ────────────────────── */}
      <AdminUserManagement />

      {/* ── Blocked IPs (Client) ─────────────────────────── */}
      <AdminBlockedIps />

      {/* ── Audit Log (Client) ───────────────────────────── */}
      <AdminAuditLog />
    </div>
  );
}
