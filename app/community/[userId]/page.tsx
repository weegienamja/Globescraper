import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import {
  getCommunityProfile,
  formatMemberSince,
  type CommunityProfileViewModel,
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true },
  });
  return {
    title: profile?.displayName ?? "Profile",
    description: `Community profile for ${profile?.displayName ?? "a GlobeScraper member"}.`,
  };
}

export default async function CommunityProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await auth();
  const currentUserId = session?.user?.id;

  // Basic existence check first
  const rawProfile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      visibility: true,
      displayName: true,
      hiddenFromCommunity: true,
      user: { select: { disabled: true } },
    },
  });

  if (!rawProfile || rawProfile.user.disabled) notFound();

  // Visibility checks
  if (rawProfile.visibility === "PRIVATE") {
    if (!currentUserId || (currentUserId !== userId && session?.user?.role !== "ADMIN")) {
      notFound();
    }
  }

  if (rawProfile.visibility === "MEMBERS_ONLY") {
    if (!currentUserId) {
      redirect("/login?callbackUrl=/community/" + userId);
    }
  }

  if (!rawProfile.displayName) {
    if (currentUserId === userId) {
      redirect("/community/edit-profile");
    }
    // Show a placeholder instead of 404 so connected users aren't confused
    return (
      <div className="profile-page">
        <Link href="/community" className="profile-page__back">
          ← Back to community
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

  // Connection status
  let connectionStatus: string | null = null;
  let isBlockedByMe = false;

  if (currentUserId && !isOwner) {
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

  return (
    <div className="profile-page">
      <Link href="/community" className="profile-page__back">
        ← Back to community
      </Link>

      {/* ── Header Card ────────────────────────── */}
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
        connectionStatus={connectionStatus}
        isBlockedByMe={isBlockedByMe}
      />

      {/* ── Two-column grid ────────────────────── */}
      <div className="profile-grid">
        {/* ═══ LEFT COLUMN ═══ */}
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

          {/* Experience & Teaching Info */}
          {(profile.certifications.length > 0 || profile.lookingForLabel || profile.languagesTeaching.length > 0) && (
            <div className="profile-section">
              <h2 className="profile-section__title">Experience &amp; Teaching Info</h2>
              <ul className="experience-list">
                {profile.certifications.length > 0 && (
                  <li className="experience-list__item">
                    <span className="experience-list__icon">✅</span>
                    {profile.certifications.join(", ")} Certified
                    <span className="experience-list__badge">✔</span>
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

          {/* Gallery */}
          <GallerySection images={profile.gallery} displayName={profile.displayName} />

          {/* Recent Activity (main column) */}
          <ActivityFeed events={profile.recentActivity} displayName={profile.displayName} />

          {/* Admin/block actions */}
          {currentUserId && !isOwner && (
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

        {/* ═══ RIGHT SIDEBAR (desktop) ═══ */}
        <aside className="profile-grid__sidebar profile-grid__sidebar--desktop">
          <StatCards stats={stats} />
          <TrustPanel
            emailVerified={profile.emailVerified}
            phoneVerified={profile.phoneVerified}
            lastActiveAt={profile.lastActiveAt}
            targetUserId={userId}
            showReport={!!currentUserId && !isOwner}
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

        {/* ═══ SIDEBAR (mobile accordion) ═══ */}
        <div className="profile-grid__sidebar profile-grid__sidebar--mobile">
          <SidebarAccordion title="Activity" defaultOpen>
            <StatCards stats={stats} />
          </SidebarAccordion>
          <SidebarAccordion title="Verification & Trust">
            <TrustPanel
              emailVerified={profile.emailVerified}
              phoneVerified={profile.phoneVerified}
              lastActiveAt={profile.lastActiveAt}
              targetUserId={userId}
              showReport={!!currentUserId && !isOwner}
            />
          </SidebarAccordion>
        </div>
      </div>
    </div>
  );
}
