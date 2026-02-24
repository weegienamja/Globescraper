import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton, BlockButton, ReportButton } from "./profile-actions";
import { INTENT_LABELS } from "@/lib/validations/community";
import { GalleryGrid } from "@/components/Lightbox";

const ENUM_COUNTRY_MAP: Record<string, string> = {
  VIETNAM: "Vietnam",
  THAILAND: "Thailand",
  CAMBODIA: "Cambodia",
  PHILIPPINES: "Philippines",
  INDONESIA: "Indonesia",
  MALAYSIA: "Malaysia",
};

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

  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      targetCountries: { select: { country: true } },
      user: { select: { name: true, disabled: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!profile || profile.user.disabled) notFound();

  // Visibility checks
  if (profile.visibility === "PRIVATE") {
    if (!currentUserId || (currentUserId !== userId && session?.user?.role !== "ADMIN")) {
      notFound();
    }
  }

  if (profile.visibility === "MEMBERS_ONLY") {
    if (!currentUserId) {
      redirect("/login?callbackUrl=/community/" + userId);
    }
  }

  // Check if community profile is set up
  if (!profile.displayName) {
    if (currentUserId === userId) {
      redirect("/community/edit-profile");
    }
    notFound();
  }

  const isOwner = currentUserId === userId;

  // Check connection status
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

  const intents: string[] = [];
  if (profile.meetupCoffee) intents.push(INTENT_LABELS.meetupCoffee);
  if (profile.meetupCityTour) intents.push(INTENT_LABELS.meetupCityTour);
  if (profile.meetupJobAdvice) intents.push(INTENT_LABELS.meetupJobAdvice);
  if (profile.meetupStudyGroup) intents.push(INTENT_LABELS.meetupStudyGroup);
  if (profile.meetupLanguageExchange) intents.push(INTENT_LABELS.meetupLanguageExchange);

  const countries = profile.targetCountries.map(
    (tc) => ENUM_COUNTRY_MAP[tc.country] ?? tc.country,
  );

  return (
    <div className="profile-view">
      <Link href="/community" className="profile-view__back">
        ← Back to community
      </Link>

      <div className="profile-view__card">
        <div className="profile-view__header">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.displayName}
              width={96}
              height={96}
              className="profile-view__avatar-img"
            />
          ) : (
            <div className="community-card__avatar community-card__avatar--lg">
              {profile.displayName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <h1 className="profile-view__name">{profile.displayName}</h1>
            {(profile.currentCity || profile.currentCountry) && (
              <p className="profile-view__location">
                📍 {[profile.currentCity, profile.currentCountry].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="profile-view__section">
            <h2>About</h2>
            <p>{profile.bio}</p>
          </div>
        )}

        {countries.length > 0 && (
          <div className="profile-view__section">
            <h2>Target Countries</h2>
            <div className="community-card__tags">
              {countries.map((c) => (
                <span key={c} className="tag">{c}</span>
              ))}
            </div>
          </div>
        )}

        {intents.length > 0 && (
          <div className="profile-view__section">
            <h2>Open to</h2>
            <div className="community-card__intents">
              {intents.map((i) => (
                <span key={i} className="intent-badge">{i}</span>
              ))}
            </div>
          </div>
        )}

        {profile.images.length > 0 && (
          <div className="profile-view__section">
            <h2>Gallery</h2>
            <GalleryGrid
              images={profile.images.map((img) => ({
                url: img.url,
                alt: `Photo by ${profile.displayName}`,
              }))}
            />
          </div>
        )}

        {/* Actions — only for other logged-in users */}
        {currentUserId && !isOwner && (
          <div className="profile-view__actions">
            {connectionStatus === "ACCEPTED" && (
              <span className="badge badge--ok">✓ Connected</span>
            )}
            {connectionStatus === "PENDING" && (
              <span className="badge badge--muted">⏳ Request pending</span>
            )}
            {!connectionStatus && !isBlockedByMe && (
              <ConnectButton toUserId={userId} />
            )}
            {connectionStatus === "DECLINED" && !isBlockedByMe && (
              <ConnectButton toUserId={userId} />
            )}
            <BlockButton targetUserId={userId} isBlocked={isBlockedByMe} />
            <ReportButton targetType="USER" targetId={userId} />
          </div>
        )}

        {isOwner && (
          <div className="profile-view__actions">
            <Link href="/community/edit-profile" className="btn btn--primary btn--sm">
              Edit profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
