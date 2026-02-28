import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRY_LABELS } from "@/lib/validations/profile";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your GlobeScraper dashboard. Manage your profile, connections, and teaching plans.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: { targetCountries: true },
  });

  // If no profile yet, redirect to complete it
  if (!profile) {
    redirect("/create-profile");
  }

  const countries = profile.targetCountries
    .map((tc) => COUNTRY_LABELS[tc.country as keyof typeof COUNTRY_LABELS])
    .join(", ");

  const hasCommunityProfile = !!profile.displayName;

  // Count pending connection requests
  const pendingRequests = await prisma.connectionRequest.count({
    where: { toUserId: session.user.id, status: "PENDING" },
  });

  // Count connections
  const connectionCount = await prisma.connectionRequest.count({
    where: {
      OR: [
        { fromUserId: session.user.id, status: "ACCEPTED" },
        { toUserId: session.user.id, status: "ACCEPTED" },
      ],
    },
  });

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 40 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        Welcome, {session.user.name}
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
        Your profile is complete. Target countries:{" "}
        <strong style={{ color: "var(--text)" }}>{countries}</strong>
      </p>

      <div className="dashboard-cards">
        {/* Community Card */}
        <div className="dashboard-card">
          <h2>Community</h2>
          {hasCommunityProfile ? (
            <>
              <p>Showing as <strong>{profile.displayName}</strong></p>
              <p className="text-muted">{connectionCount} connection{connectionCount !== 1 ? "s" : ""}</p>
              <div className="dashboard-card__links">
                <Link href="/community" className="btn btn--outline btn--sm">Browse community</Link>
                <Link href="/community/edit-profile" className="btn btn--ghost btn--sm">Edit profile</Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted">Connect with other teachers by setting up your community profile.</p>
              <Link href="/community/edit-profile" className="btn btn--primary btn--sm">Set up community profile</Link>
            </>
          )}
        </div>

        {/* Requests Card */}
        <div className="dashboard-card">
          <h2>Connection Requests</h2>
          {pendingRequests > 0 ? (
            <p><strong>{pendingRequests}</strong> pending request{pendingRequests !== 1 ? "s" : ""}</p>
          ) : (
            <p className="text-muted">No pending requests</p>
          )}
          <Link href="/dashboard/requests" className="btn btn--outline btn--sm">View requests</Link>
        </div>

        {/* Meetups Card */}
        <div className="dashboard-card">
          <h2>Meetups</h2>
          <p className="text-muted">Find or create meetups with other teachers.</p>
          <div className="dashboard-card__links">
            <Link href="/meetups" className="btn btn--outline btn--sm">Browse meetups</Link>
            <Link href="/meetups/new" className="btn btn--ghost btn--sm">Create meetup</Link>
          </div>
        </div>

        {/* What's Next Card */}
        <div className="dashboard-card">
          <h2>What&apos;s Next</h2>
          <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
            <li>We&apos;re building curated job matches for your profile.</li>
            <li>You&apos;ll receive email alerts when new positions open.</li>
            <li>Check back soon for your personalised dashboard.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
