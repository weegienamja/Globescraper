import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { touchLastActive } from "@/lib/last-active";
import { needsOnboarding, isRecruiter } from "@/lib/rbac";
import { CommunityGrid } from "@/components/community/CommunityGrid";
import type { CommunityProfile } from "@/components/community/CommunityGrid";

export const dynamic = "force-dynamic";

const RELOCATION_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  SECURED_JOB: "Secured Job",
  ARRIVED: "Arrived",
  TEACHING: "Teaching",
  RENEWING_VISA: "Renewing Visa",
};

export const metadata = {
  title: "Community | GlobeScraper",
  description:
    "Connect with teachers moving to or living in Southeast Asia. Share tips, find friends, and get support.",
  alternates: { canonical: "/community" },
  robots: { index: false },
  openGraph: {
    title: "Community | GlobeScraper",
    description:
      "Connect with teachers moving to or living in Southeast Asia.",
    url: "/community",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
};

/* -- Invite page for logged-out visitors -- */
function CommunityInvite() {
  return (
    <div className="invite-page">
      <div className="invite-hero">
        <span className="invite-hero__emoji">🌏</span>
        <h1 className="invite-hero__title">Join the Community</h1>
        <p className="invite-hero__sub">
          Connect with teachers who are moving to or already living in Southeast Asia.
          Share tips, find friends, and make your move easier.
        </p>
        <div className="invite-hero__cta">
          <Link href="/signup?callbackUrl=/community" className="btn btn--primary">
            Create a free account
          </Link>
          <Link href="/login?callbackUrl=/community" className="btn btn--outline">
            Sign in
          </Link>
        </div>
      </div>

      {/* Role CTA cards */}
      <div className="invite-role-cards">
        <div className="invite-role-card">
          <div className="invite-role-card__avatar">👩‍🏫</div>
          <h3 className="invite-role-card__title">Teacher</h3>
          <p className="invite-role-card__text">
            Moving or living in Southeast Asia? Join the community.
          </p>
          <p className="invite-role-card__link">More by sees to posted teachers.</p>
          <Link href="/signup?callbackUrl=/community" className="btn btn--primary btn--sm">
            Sign up
          </Link>
        </div>
        <div className="invite-role-card">
          <div className="invite-role-card__avatar">📚</div>
          <h3 className="invite-role-card__title">Student</h3>
          <p className="invite-role-card__text">
            Looking to study or do some language exchange? Join the community.
          </p>
          <p className="invite-role-card__link">Visus fur cras in thainaness.</p>
          <Link href="/signup?callbackUrl=/community" className="btn btn--primary btn--sm">
            Sign up
          </Link>
        </div>
        <div className="invite-role-card">
          <div className="invite-role-card__avatar">🏢</div>
          <h3 className="invite-role-card__title">Recruiter</h3>
          <p className="invite-role-card__text">
            Recruiting English teachers? Find qualified candidates with our filter.
          </p>
          <p className="invite-role-card__link">Views for teachers.</p>
          <Link href="/signup?callbackUrl=/community" className="btn btn--primary btn--sm">
            Connect
          </Link>
        </div>
      </div>

      <div className="invite-features">
        <div className="invite-feature">
          <span className="invite-feature__icon">👋</span>
          <h3 className="invite-feature__title">Browse Profiles</h3>
          <p className="invite-feature__text">
            Find teachers heading to the same country or city as you. See who&apos;s looking
            for coffee meetups, city tours, job advice, or study groups.
          </p>
        </div>
        <div className="invite-feature">
          <span className="invite-feature__icon">💬</span>
          <h3 className="invite-feature__title">Send Connection Requests</h3>
          <p className="invite-feature__text">
            Reach out to people with similar plans. Once connected, you can share
            contact details and start planning together.
          </p>
        </div>
        <div className="invite-feature">
          <span className="invite-feature__icon">📸</span>
          <h3 className="invite-feature__title">Share Your Story</h3>
          <p className="invite-feature__text">
            Create a profile with your photo, gallery, target countries, and what
            you&apos;re looking for. Let others find you.
          </p>
        </div>
      </div>

      <div className="invite-bottom">
        <p className="invite-bottom__text">
          Already have an account?{" "}
          <Link href="/login?callbackUrl=/community">Sign in</Link> to browse the community.
        </p>
      </div>
    </div>
  );
}

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user?.id) return <CommunityInvite />;

  // Role-based redirects
  const userRole = session.user.role;
  if (needsOnboarding(userRole)) redirect("/onboarding/who-are-you");
  if (isRecruiter(userRole)) redirect("/community/recruiter-dashboard");

  // Fire-and-forget last active update
  touchLastActive(session.user.id);

  // Get user's blocks to exclude
  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerUserId: session.user.id },
        { blockedUserId: session.user.id },
      ],
    },
    select: { blockerUserId: true, blockedUserId: true },
  });
  const blockedIds = new Set(
    blocks.flatMap((b) => [b.blockerUserId, b.blockedUserId]),
  );
  blockedIds.delete(session.user.id);

  // Fetch ALL visible profiles (no server-side filtering — client handles it)
  const where: Record<string, unknown> = {
    displayName: { not: null },
    visibility: { not: "PRIVATE" },
    user: {
      disabled: false,
      role: { in: ["TEACHER", "STUDENT", "USER"] },
    },
    hiddenFromCommunity: false,
    userId: { notIn: Array.from(blockedIds) },
  };

  const profiles = await prisma.profile.findMany({
    where,
    take: 100,
    orderBy: { updatedAt: "desc" },
    select: {
      userId: true,
      displayName: true,
      avatarUrl: true,
      currentCountry: true,
      currentCity: true,
      relocationStage: true,
      teflTesolCertified: true,
      meetupCoffee: true,
      meetupCityTour: true,
      meetupJobAdvice: true,
      meetupStudyGroup: true,
      meetupLanguageExchange: true,
      meetupVisaHelp: true,
      meetupSchoolReferrals: true,
      interests: true,
      languagesTeaching: true,
      certifications: true,
      updatedAt: true,
      user: { select: { username: true, lastActiveAt: true, emailVerified: true, role: true } },
      targetCountries: { select: { country: true } },
    },
  });

  // Serialise dates for the client component
  const serialised: CommunityProfile[] = profiles.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
    user: {
      ...p.user,
      lastActiveAt: p.user.lastActiveAt?.toISOString() ?? null,
      emailVerified: p.user.emailVerified?.toISOString() ?? null,
    },
  }));

  // Check if current user has a community profile
  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  });
  const hasSetup = !!myProfile?.displayName;

  // "Who you might want to meet" sidebar suggestions (top 4 recent active, not self)
  const suggestions = profiles
    .filter((p) => p.userId !== session.user.id)
    .slice(0, 4);

  // Community stats
  const [memberCount, onlineCount, messagesThisMonth] = await Promise.all([
    prisma.profile.count({ where: { displayName: { not: null }, visibility: { not: "PRIVATE" } } }),
    prisma.user.count({
      where: {
        lastActiveAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        disabled: false,
      },
    }),
    prisma.message.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  function profileUrl(p: typeof profiles[number]): string {
    return `/community/${p.user.username ?? p.userId}`;
  }

  function timeAgo(date: Date | null): string {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 15) return "Online now";
    const hours = Math.floor(minutes / 60);
    if (hours < 1) return `Active ${minutes}m ago`;
    if (hours < 24) return `Active ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 1) return "Active today";
    if (days === 1) return "Active yesterday";
    if (days < 7) return `Active ${days}d ago`;
    return `Active ${Math.floor(days / 7)}w ago`;
  }

  return (
    <div className="community-page">
      {/* Header */}
      <div className="community-header">
        <div className="community-header__text">
          <h1>Community</h1>
          <p className="community-header__sub">
            Connect with teachers moving to or living in Southeast Asia.
          </p>
        </div>
      </div>

      {/* Role CTA cards (logged-in) */}
      <div className="invite-role-cards invite-role-cards--compact">
        <div className="invite-role-card invite-role-card--sm">
          <div className="invite-role-card__avatar">👩‍🏫</div>
          <h3 className="invite-role-card__title">Teacher</h3>
          <p className="invite-role-card__text">
            Moving or living in Southeast Asia? Join the community.
          </p>
        </div>
        <div className="invite-role-card invite-role-card--sm">
          <div className="invite-role-card__avatar">📚</div>
          <h3 className="invite-role-card__title">Student</h3>
          <p className="invite-role-card__text">
            Looking to study or do some language exchange?
          </p>
        </div>
        <div className="invite-role-card invite-role-card--sm">
          <div className="invite-role-card__avatar">🏢</div>
          <h3 className="invite-role-card__title">Recruiter</h3>
          <p className="invite-role-card__text">
            Recruiting English teachers? Find qualified candidates.
          </p>
        </div>
      </div>

      <div className="community-layout">
        {/* Main column — client-side filtered grid */}
        <div className="community-layout__main">
          <CommunityGrid profiles={serialised} hasSetup={hasSetup} />
        </div>

        {/* Sidebar */}
        <aside className="community-layout__sidebar">
          {/* Who you might want to meet */}
          {suggestions.length > 0 && (
            <div className="sidebar-card">
              <h3 className="sidebar-card__title">Who you might want to meet</h3>
              <ul className="sidebar-card__list">
                {suggestions.map((s) => (
                  <li key={s.userId} className="sidebar-card__item">
                    <Link href={profileUrl(s)} className="sidebar-card__link">
                      <div className="sidebar-card__avatar-wrap">
                        {s.avatarUrl ? (
                          <Image src={s.avatarUrl} alt={s.displayName ?? ""} width={40} height={40} className="sidebar-card__avatar-img" />
                        ) : (
                          <span className="sidebar-card__avatar-fallback">{s.displayName?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="sidebar-card__detail">
                        <span className="sidebar-card__name">
                          {s.displayName}
                          <span className="community-card__stage-pill community-card__stage-pill--sm">
                            {RELOCATION_LABEL[s.relocationStage] ?? "Planning"}
                          </span>
                        </span>
                        <span className="sidebar-card__loc">
                          {[s.currentCity, s.currentCountry].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recently active */}
          <div className="sidebar-card">
            <h3 className="sidebar-card__title">Recently active</h3>
            <ul className="sidebar-card__list">
              {profiles
                .filter((p) => p.userId !== session.user.id && timeAgo(p.user.lastActiveAt).includes("Active"))
                .slice(0, 4)
                .map((p) => (
                  <li key={p.userId} className="sidebar-card__item sidebar-card__item--compact">
                    <Link href={profileUrl(p)} className="sidebar-card__link">
                      {p.avatarUrl ? (
                        <Image src={p.avatarUrl} alt={p.displayName ?? ""} width={32} height={32} className="sidebar-card__avatar-img sidebar-card__avatar-img--sm" />
                      ) : (
                        <span className="sidebar-card__avatar-fallback sidebar-card__avatar-fallback--sm">{p.displayName?.[0]?.toUpperCase()}</span>
                      )}
                      <div className="sidebar-card__detail">
                        <span className="sidebar-card__name">{p.displayName}</span>
                        <span className="sidebar-card__loc">
                          {[p.currentCity, p.currentCountry].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Community stats */}
          <div className="sidebar-card">
            <h3 className="sidebar-card__title">Community stats</h3>
            <ul className="sidebar-card__stats">
              <li>👥 <strong>{memberCount.toLocaleString()}</strong> Members</li>
              <li>🟢 <strong>{onlineCount.toLocaleString()}</strong> Online now</li>
              <li>💬 <strong>{messagesThisMonth.toLocaleString()}</strong> Messages this month</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
