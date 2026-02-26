import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminEmailDashboard } from "./email-dashboard";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Email System",
};

export default async function AdminEmailPage() {
  noStore();
  await requireAdmin();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Helper for current stats query
  const activeWhere = { status: "ACTIVE" as const };

  // Fetch all data in parallel
  const [
    campaigns,
    // Current subscriber counts
    totalUsers,
    optedIn,
    unsubscribed,
    verified,
    eligible,
    // Last-week subscriber counts (snapshot: users created before last week)
    totalUsersLastWeek,
    optedInLastWeek,
    unsubscribedLastWeek,
    verifiedLastWeek,
    eligibleLastWeek,
    // Full subscriber list for Subscribers tab
    subscriberList,
    // Suppressed users for Suppression tab
    suppressedUsers,
    // Users for Single Email recipient picker
    allUsers,
    // Email logs for Analytics
    emailLogs,
    // Daily stats for chart (last 14 days)
    recentLogRows,
  ] = await Promise.all([
    prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // Current counts
    prisma.user.count({ where: activeWhere }),
    prisma.user.count({ where: { ...activeWhere, emailMarketingOptIn: true } }),
    prisma.user.count({ where: { ...activeWhere, emailUnsubscribed: true } }),
    prisma.user.count({ where: { ...activeWhere, emailVerified: { not: null } } }),
    prisma.user.count({
      where: {
        ...activeWhere,
        emailMarketingOptIn: true,
        emailUnsubscribed: false,
        emailVerified: { not: null },
      },
    }),
    // Last week counts (users that existed a week ago)
    prisma.user.count({ where: { ...activeWhere, createdAt: { lt: oneWeekAgo } } }),
    prisma.user.count({ where: { ...activeWhere, emailMarketingOptIn: true, createdAt: { lt: oneWeekAgo } } }),
    prisma.user.count({ where: { ...activeWhere, emailUnsubscribed: true, createdAt: { lt: oneWeekAgo } } }),
    prisma.user.count({ where: { ...activeWhere, emailVerified: { not: null }, createdAt: { lt: oneWeekAgo } } }),
    prisma.user.count({
      where: {
        ...activeWhere,
        emailMarketingOptIn: true,
        emailUnsubscribed: false,
        emailVerified: { not: null },
        createdAt: { lt: oneWeekAgo },
      },
    }),
    // Full subscriber list
    prisma.user.findMany({
      where: activeWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        emailMarketingOptIn: true,
        emailUnsubscribed: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    // Suppressed users
    prisma.user.findMany({
      where: { emailUnsubscribed: true, ...activeWhere },
      select: { id: true, email: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    // Email recipient picker
    prisma.user.findMany({
      where: { ...activeWhere, emailVerified: { not: null } },
      select: { id: true, email: true, name: true, emailMarketingOptIn: true, emailUnsubscribed: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    // Email logs for analytics
    prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        subject: true,
        type: true,
        status: true,
        openedAt: true,
        clickedAt: true,
        createdAt: true,
      },
    }),
    // Recent logs for daily stats chart
    prisma.emailLog.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true, status: true, openedAt: true },
    }),
  ]);

  // Build daily stats
  const dailyMap: Record<string, { sent: number; opened: number; bounced: number }> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { sent: 0, opened: 0, bounced: 0 };
  }
  for (const row of recentLogRows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    if (dailyMap[key]) {
      if (row.status === "SENT") dailyMap[key].sent++;
      if (row.openedAt) dailyMap[key].opened++;
      if (row.status === "BOUNCED") dailyMap[key].bounced++;
    }
  }
  const dailyStats = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const stats = {
    totalUsers,
    optedIn,
    unsubscribed,
    verified,
    eligible,
    totalUsersLastWeek,
    optedInLastWeek,
    unsubscribedLastWeek,
    verifiedLastWeek,
    eligibleLastWeek,
  };

  // Serialize subscribers for client
  const subscribers = subscriberList.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified?.toISOString() || null,
    emailMarketingOptIn: u.emailMarketingOptIn,
    emailUnsubscribed: u.emailUnsubscribed,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt?.toISOString() || null,
  }));

  const suppressed = suppressedUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    reason: "unsubscribed" as const,
    date: u.updatedAt.toISOString(),
  }));

  return (
    <div className="admin">
      <div className="admin__header">
        <div className="admin__header-info">
          <h1 className="admin__title">Email System</h1>
          <div className="admin__meta">
            <span>Send emails, manage campaigns, track engagement &amp; analytics</span>
          </div>
        </div>
        <Link href="/admin" className="btn btn--outline btn--sm">
          Back to Dashboard
        </Link>
      </div>

      <AdminEmailDashboard
        initialCampaigns={JSON.parse(JSON.stringify(campaigns))}
        initialStats={stats}
        initialUsers={JSON.parse(JSON.stringify(allUsers))}
        initialSubscribers={subscribers}
        initialSuppressed={suppressed}
        initialLogs={JSON.parse(JSON.stringify(emailLogs))}
        dailyStats={dailyStats}
      />
    </div>
  );
}
