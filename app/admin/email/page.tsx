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

  // Fetch initial data server-side
  const [
    campaigns,
    subscriberStats,
    recentLogs,
    suppressedUsers,
    allUsers,
  ] = await Promise.all([
    prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { emailMarketingOptIn: true, status: "ACTIVE" } }),
      prisma.user.count({ where: { emailUnsubscribed: true, status: "ACTIVE" } }),
      prisma.user.count({ where: { emailVerified: { not: null }, status: "ACTIVE" } }),
      prisma.user.count({
        where: {
          emailMarketingOptIn: true,
          emailUnsubscribed: false,
          emailVerified: { not: null },
          status: "ACTIVE",
        },
      }),
    ]),
    prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: { select: { email: true, name: true } },
        campaign: { select: { subject: true } },
      },
    }),
    prisma.user.findMany({
      where: { emailUnsubscribed: true, status: "ACTIVE" },
      select: { id: true, email: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", emailVerified: { not: null } },
      select: { id: true, email: true, name: true, emailMarketingOptIn: true, emailUnsubscribed: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const stats = {
    totalUsers: subscriberStats[0],
    optedIn: subscriberStats[1],
    unsubscribed: subscriberStats[2],
    verified: subscriberStats[3],
    eligible: subscriberStats[4],
  };

  return (
    <div className="admin">
      <div className="admin__header">
        <div className="admin__header-info">
          <h1 className="admin__title">Email System</h1>
          <div className="admin__meta">
            <span>Send single emails, manage campaigns, and track engagement</span>
          </div>
        </div>
        <Link href="/admin" className="btn btn--outline btn--sm">
          Back to Dashboard
        </Link>
      </div>

      <AdminEmailDashboard
        initialCampaigns={JSON.parse(JSON.stringify(campaigns))}
        initialStats={stats}
        initialLogs={JSON.parse(JSON.stringify(recentLogs))}
        initialSuppressed={JSON.parse(JSON.stringify(suppressedUsers))}
        initialUsers={JSON.parse(JSON.stringify(allUsers))}
      />
    </div>
  );
}
