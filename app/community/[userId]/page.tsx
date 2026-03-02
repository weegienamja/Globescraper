import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getCommunityProfile,
  formatMemberSince,
} from "@/lib/community-profile";
import {
  ProfileHeaderCard,
  RelocationStepper,
  StatCards,
  TrustPanel,
  Chips,
  GallerySection,
  ActivityFeed,
  SidebarAccordion,
} from "@/components/community";
import { BlockButton, HideButton } from "./profile-actions";
import { JsonLd } from "@/components/JsonLd";
import { isRecruiter, SOCIAL_ROLES } from "@/lib/rbac";
import { touchLastActive } from "@/lib/last-active";
import type { AppRole } from "@/types/next-auth";

// -- Resolve a slug (username or userId) to a userId --
async function resolveSlug(slug: string) {
  // Try username first (more common in new URLs)
  const byUsername = await prisma.user.findUnique({
    where: { username: slug },
    select: { id: true, username: true, role: true },
  });
  if (byUsername) return byUsername;

  // Fallback: try userId (backward compat for old links)
  const byId = await prisma.user.findUnique({
    where: { id: slug },
    select: { id: true, username: true, role: true },
  });
  return byId ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId: slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) return { title: "Profile not found" };

  const profile = await prisma.profile.findUnique({
    where: { userId: resolved.id },
    select: {
      displayName: true,
      currentCity: true,
      currentCountry: true,
      bio: true,
      avatarUrl: true,
      showCityPublicly: true,
    },
  });

  if (!profile?.displayName) return { title: "Profile" };

  const locationParts: string[] = [];
  if (profile.showCityPublicly && profile.currentCity) locationParts.push(profile.currentCity);
  if (profile.currentCountry) locationParts.push(profile.currentCountry);
  const locationStr = locationParts.join(", ");

  const title = locationStr
    ? `${profile.displayName} in ${locationStr} | GlobeScraper Community`
    : `${profile.displayName} | GlobeScraper Community`;

  const description = profile.bio
    ? profile.bio.slice(0, 160)
    : `Community profile for ${profile.displayName}${locationStr ? ` in ${locationStr}` : ""}.`;

  const canonicalSlug = resolved.username ?? resolved.id;

  return {
    title,
    description,
    alternates: { canonical: `/community/${canonicalSlug}` },
    openGraph: {
      title,
      description,
      url: `/community/${canonicalSlug}`,
      ...(profile.avatarUrl
        ? { images: [{ url: profile.avatarUrl, width: 96, height: 96 }] }
        : {}),
    },
  };
}

export default async function CommunityProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();

  const userId = resolved.id;

  // If accessed by userId but user has a username, 301 redirect to canonical URL
  if (slug === userId && resolved.username) {
    redirect(`/community/${resolved.username}`);
  }

  const session = await auth();
  const currentUserId = session?.user?.id;
  const viewerRole = (session?.user?.role ?? "USER") as AppRole;
  const viewerIsRecruiter = isRecruiter(viewerRole);

  // Touch last-active for the viewer
  if (currentUserId) touchLastActive(currentUserId);

  // Basic existence check
  const rawProfile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      visibility: true,
      displayName: true,
      hiddenFromCommunity: true,
      user: { select: { disabled: true, role: true, username: true } },
    },
  });

  if (!rawProfile || rawProfile.user.disabled) notFound();

  // Recruiters can only view teacher/student profiles (no social features)
  const profileRole = rawProfile.user.role as AppRole;
  if (viewerIsRecruiter && !SOCIAL_ROLES.includes(profileRole)) {
    notFound();
  }

  // Visibility checks
  if (rawProfile.visibility === "PRIVATE") {
    if (!currentUserId || (currentUserId !== userId && session?.user?.role !== "ADMIN")) {
      notFound();
    }
  }

  if (rawProfile.visibility === "MEMBERS_ONLY") {
    if (!currentUserId) {
      const canonicalSlug = resolved.username ?? userId;
      redirect("/login?callbackUrl=/community/" + canonicalSlug);
    }
  }

  if (!rawProfile.displayName) {
    if (currentUserId === userId) {
      redirect("/community/edit-profile");
    }
    return (
      <div className="profile-page">
        <Link href="/community" className="profile-page__back">
          &larr; Back to community
        </Link>
        <div className="profile-section" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>👤</div>
          <h2 style={{ marginBottom: 8 }}>Profile Not Yet Complete</h2>
          <p style={{ color: "var(--text-muted)" }}>
            This member hasn&apos;t finished setting up their profile yet. Check back later!
          </p>
        </div>
      </div>
    );
  }

  // Full profile view model
  const profile = await getCommunityProfile(userId, currentUserId);
  if (!profile) notFound();

  const isOwner = currentUserId === userId;
  const isAdmin = session?.user?.role === "ADMIN";

  // Connection/block status - only for social roles (not recruiters)
  let connectionStatus: string | null = null;
  let isBlockedByMe = false;

  if (currentUserId && !isOwner && !viewerIsRecruiter) {
    const [connection, block] = await Promise.all([
      prisma.connectionRequest.findFirst({
        where: {
          OR: [
            { fromUserId: currentUserId, toUserId: userId },
            { fromUserId: userId, toUserId: currentUserId },
          ],
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.block.findFirst({
        where: { blockerUserId: currentUserId, blockedUserId: userId },
      }),
    ]);
    connectionStatus = connection?.status ?? null;
    isBlockedByMe = !!block;
  }

  // Location string (respect showCityPublicly)
  const locationParts: string[] = [];
  if (profile.showCityPublicly && profile.currentCity) locationParts.push(profile.currentCity);
  if (profile.currentCountry) locationParts.push(profile.currentCountry);
  const locationStr = locationParts.join(", ");

  const stats = [
    { label: "Posts written", value: profile.postsCount },
    { label: "Comments", value: profile.commentsCount },
    { label: "Meetups attended", value: profile.meetupsAttendedCount },
    { label: "Connections", value: profile.connectionsCount },
  ];

  // JSON-LD Person schema
  const canonicalSlug = resolved.username ?? userId;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.displayName,
    url: `https://globescraper.com/community/${canonicalSlug}`,
    ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    ...(locationStr ? { address: { "@type": "PostalAddress", addressLocality: locationStr } } : {}),
    ...(profile.bio ? { description: profile.bio.slice(0, 300) } : {}),
  };

  // Determine whether to show social features (connect, message, block)
  const showSocialFeatures = !viewerIsRecruiter;

  return (
    <div className="profile-page">
      <JsonLd data={jsonLd} />

      <Link href={viewerIsRecruiter ? "/community/recruiter-dashboard" : "/community"} className="profile-page__back">
        &larr; {viewerIsRecruiter ? "Back to dashboard" : "Back to community"}
      </Link>

      {/* Recruiter notice banner */}
      {viewerIsRecruiter && (
        <div className="profile-notice profile-notice--recruiter">
          <span className="profile-notice__icon">🏢</span>
          <p className="profile-notice__text">
            You are viewing this profile as a recruiter. Social features (connect, message) are not available.
          </p>
        </div>
      )}

      <ProfileHeaderCard
        displayName={profile.displayName}
        avatarUrl={profile.avatarUrl}
        location={locationStr}
        relocationStageLabel={profile.relocationStageLabel}
        memberSince={formatMemberSince(profile.memberSince)}
        replyTimeLabel={profile.replyTimeLabel}
        emailVerified={profile.emailVerified}
        userId={userId}
        isOwner={isOwner}
        connectionStatus={showSocialFeatures ? connectionStatus : null}
        isBlockedByMe={showSocialFeatures ? isBlockedByMe : false}
        hideActions={viewerIsRecruiter}
      />

      <div className="profile-grid">
        {/* Left column */}
        <div className="profile-grid__main">
          <RelocationStepper currentStageIndex={profile.relocationStageIndex} />

          {/* About */}
          {profile.bio && (
            <div className="profile-section">
              <h2 className="profile-section__title">
                About {profile.displayName}
              </h2>
              <p className="profile-section__body">{profile.bio}</p>
            </div>
          )}

          {/* Experience and Teaching Info */}
          {(profile.certifications.length > 0 || profile.lookingForLabel || profile.languagesTeaching.length > 0) && (
            <div className="profile-section">
              <h2 className="profile-section__title">Experience and Teaching Info</h2>
              <ul className="experience-list">
                {profile.certifications.length > 0 && (
                  <li className="experience-list__item">
                    <span className="experience-list__icon">✅</span>
                    {profile.certifications.join(", ")} Certified
                    <span className="experience-list__badge">&#10004;</span>
                  </li>
                )}
                {profile.lookingForLabel && (
                  <li className="experience-list__item">
                    <span className="experience-list__icon">🔍</span>
                    Looking for: <strong>{profile.lookingForLabel}</strong>
                  </li>
                )}
                {profile.languagesTeaching.length > 0 && (
                  <li className="experience-list__item">
                    <span className="experience-list__icon">🌐</span>
                    Comfortable teaching:{" "}
                    <strong>{profile.languagesTeaching.join(", ")}</strong>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Available For chips */}
          <Chips title="Available For" chips={profile.availableFor} variant="accent" />

          {/* Interests chips */}
          <Chips title="Interests" chips={profile.interests} />

          {/* Target countries */}
          {profile.targetCountries.length > 0 && (
            <div className="profile-section">
              <h2 className="profile-section__title">Target Countries</h2>
              <div className="profile-section__chips">
                {profile.targetCountries.map((c) => (
                  <span key={c} className="tag tag--country">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          <GallerySection images={profile.gallery} displayName={profile.displayName} />

          {/* Recent Activity (main column) */}
          <ActivityFeed events={profile.recentActivity} displayName={profile.displayName} />

          {/* Admin/block actions - only for social role viewers */}
          {showSocialFeatures && currentUserId && !isOwner && (
            <div className="profile-section profile-section--actions">
              <BlockButton targetUserId={userId} isBlocked={isBlockedByMe} />
              {isAdmin && (
                <HideButton
                  targetUserId={userId}
                  isHidden={!!rawProfile.hiddenFromCommunity}
                />
              )}
            </div>
          )}

          {/* Owner edit button (mobile) */}
          {isOwner && (
            <div className="profile-section profile-section--actions profile-section--mobile-only">
              <Link href="/community/edit-profile" className="btn btn--primary">
                Edit profile
              </Link>
            </div>
          )}
        </div>

        {/* Right sidebar (desktop) */}
        <aside className="profile-grid__sidebar profile-grid__sidebar--desktop">
          <StatCards stats={stats} />
          <TrustPanel
            emailVerified={profile.emailVerified}
            phoneVerified={profile.phoneVerified}
            lastActiveAt={profile.lastActiveAt}
            targetUserId={userId}
            showReport={showSocialFeatures && !!currentUserId && !isOwner}
          />
          {/* Quick recent items */}
          {profile.recentActivity.length > 0 && (
            <div className="profile-sidebar-card">
              <h3 className="profile-sidebar-card__title">Recent Activity</h3>
              <ul className="sidebar-recent-list">
                {profile.recentActivity.slice(0, 3).map((event) => (
                  <li key={event.id} className="sidebar-recent-list__item">
                    <span className="sidebar-recent-list__icon">
                      {event.eventType === "POSTED"
                        ? "📝"
                        : event.eventType === "COMMENTED"
                          ? "💬"
                          : event.eventType === "RSVP"
                            ? "🎉"
                            : "🤝"}
                    </span>
                    <div>
                      <span className="sidebar-recent-list__title">
                        {event.linkUrl ? (
                          <a href={event.linkUrl}>{event.title}</a>
                        ) : (
                          event.title
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Sidebar (mobile accordion) */}
        <div className="profile-grid__sidebar profile-grid__sidebar--mobile">
          <SidebarAccordion title="Activity" defaultOpen>
            <StatCards stats={stats} />
          </SidebarAccordion>
          <SidebarAccordion title="Verification and Trust">
            <TrustPanel
              emailVerified={profile.emailVerified}
              phoneVerified={profile.phoneVerified}
              lastActiveAt={profile.lastActiveAt}
              targetUserId={userId}
              showReport={showSocialFeatures && !!currentUserId && !isOwner}
            />
          </SidebarAccordion>
        </div>
      </div>
    </div>
  );
}
