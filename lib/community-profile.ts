import { prisma } from "@/lib/prisma";
import { canonicalPair } from "@/lib/connections";
import {
  INTENT_LABELS,
  RELOCATION_STAGES,
  LOOKING_FOR_OPTIONS,
  REPLY_TIME_OPTIONS,
} from "@/lib/validations/community";

// ── Types ────────────────────────────────────────────────────

export type CommunityProfileViewModel = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  currentCity: string | null;
  currentCountry: string | null;
  showCityPublicly: boolean;
  memberSince: Date;
  replyTimeLabel: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastActiveAt: Date | null;
  // Relocation
  relocationStage: string;
  relocationStageLabel: string;
  relocationStageIndex: number;
  // About
  bio: string | null;
  // Experience
  certifications: string[];
  lookingForLabel: string | null;
  languagesTeaching: string[];
  // Chips
  availableFor: string[];
  interests: string[];
  // Gallery
  gallery: { id: string; url: string; caption: string | null }[];
  // Stats
  postsCount: number;
  commentsCount: number;
  meetupsAttendedCount: number;
  connectionsCount: number;
  // Connections preview
  connectionsPreview: { userId: string; displayName: string; avatarUrl: string | null }[];
  mutualConnectionsCount: number;
  // Recent activity
  recentActivity: {
    id: string;
    eventType: string;
    title: string;
    linkUrl: string | null;
    createdAt: Date;
  }[];
  // Target countries
  targetCountries: string[];
  // Visibility
  visibility: string;
};

const ENUM_COUNTRY_MAP: Record<string, string> = {
  VIETNAM: "Vietnam",
  THAILAND: "Thailand",
  CAMBODIA: "Cambodia",
  PHILIPPINES: "Philippines",
  INDONESIA: "Indonesia",
  MALAYSIA: "Malaysia",
};

// ── Main query ───────────────────────────────────────────────

export async function getCommunityProfile(
  userId: string,
  viewerUserId?: string | null,
): Promise<CommunityProfileViewModel | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      targetCountries: { select: { country: true } },
      user: {
        select: {
          name: true,
          disabled: true,
          emailVerified: true,
          lastActiveAt: true,
          createdAt: true,
        },
      },
      images: { orderBy: { sortOrder: "asc" }, take: 9 },
      activityEvents: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!profile || profile.user.disabled || !profile.displayName) return null;

  // Build available-for chips
  const availableFor: string[] = [];
  if (profile.meetupCoffee) availableFor.push(INTENT_LABELS.meetupCoffee);
  if (profile.meetupCityTour) availableFor.push(INTENT_LABELS.meetupCityTour);
  if (profile.meetupJobAdvice) availableFor.push(INTENT_LABELS.meetupJobAdvice);
  if (profile.meetupStudyGroup) availableFor.push(INTENT_LABELS.meetupStudyGroup);
  if (profile.meetupLanguageExchange) availableFor.push(INTENT_LABELS.meetupLanguageExchange);
  if (profile.meetupVisaHelp) availableFor.push(INTENT_LABELS.meetupVisaHelp);
  if (profile.meetupSchoolReferrals) availableFor.push(INTENT_LABELS.meetupSchoolReferrals);
  if (profile.meetupExploring) availableFor.push(INTENT_LABELS.meetupExploring);

  // Relocation stage
  const stageIndex = RELOCATION_STAGES.findIndex(
    (s) => s.value === profile.relocationStage,
  );
  const stageLabel =
    RELOCATION_STAGES.find((s) => s.value === profile.relocationStage)?.label ??
    "Planning";

  // Looking for
  const lookingForLabel =
    LOOKING_FOR_OPTIONS.find((o) => o.value === profile.lookingFor)?.label ?? null;

  // Reply time
  const replyTimeLabel =
    REPLY_TIME_OPTIONS.find((o) => o.value === profile.replyTimeHint)?.label ?? null;

  // Parse JSON arrays safely
  const certifications = safeJsonArray(profile.certifications);
  const languagesTeaching = safeJsonArray(profile.languagesTeaching);
  const interests = safeJsonArray(profile.interests);

  // Countries
  const targetCountries = profile.targetCountries.map(
    (tc) => ENUM_COUNTRY_MAP[tc.country] ?? tc.country,
  );

  // Stats: counts from DB
  const [connectionsCount, meetupsAttendedCount] = await Promise.all([
    prisma.connection.count({
      where: {
        status: "ACCEPTED",
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
    }),
    prisma.meetupAttendee.count({
      where: { userId, status: "GOING" },
    }),
  ]);

  // Connections preview (up to 3)
  const connections = await prisma.connection.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
    take: 3,
    orderBy: { acceptedAt: "desc" },
    include: {
      userLow: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      userHigh: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
    },
  });

  const connectionsPreview = connections.map((c) => {
    const other = c.userLowId === userId ? c.userHigh : c.userLow;
    return {
      userId: other.id,
      displayName: other.profile?.displayName ?? "Member",
      avatarUrl: other.profile?.avatarUrl ?? null,
    };
  });

  // Mutual connections count (if viewer is logged in)
  let mutualConnectionsCount = 0;
  if (viewerUserId && viewerUserId !== userId) {
    // Find users connected to both
    const [viewerConns, profileConns] = await Promise.all([
      prisma.connection.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ userLowId: viewerUserId }, { userHighId: viewerUserId }],
        },
        select: { userLowId: true, userHighId: true },
      }),
      prisma.connection.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ userLowId: userId }, { userHighId: userId }],
        },
        select: { userLowId: true, userHighId: true },
      }),
    ]);

    const viewerSet = new Set(
      viewerConns.map((c) =>
        c.userLowId === viewerUserId ? c.userHighId : c.userLowId,
      ),
    );
    const profileSet = new Set(
      profileConns.map((c) =>
        c.userLowId === userId ? c.userHighId : c.userLowId,
      ),
    );

    for (const id of viewerSet) {
      if (profileSet.has(id)) mutualConnectionsCount++;
    }
  }

  // Activity events from the activity table
  const recentActivity = profile.activityEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    title: e.title,
    linkUrl: e.linkUrl,
    createdAt: e.createdAt,
  }));

  // Post/comment counts — derive from activity events or use 0
  const postsCount = await prisma.activityEvent.count({
    where: { profileId: profile.id, eventType: "POSTED" },
  });
  const commentsCount = await prisma.activityEvent.count({
    where: { profileId: profile.id, eventType: "COMMENTED" },
  });

  return {
    userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    currentCity: profile.currentCity,
    currentCountry: profile.currentCountry,
    showCityPublicly: profile.showCityPublicly,
    memberSince: profile.user.createdAt,
    replyTimeLabel,
    emailVerified: !!profile.user.emailVerified,
    phoneVerified: profile.phoneVerified,
    lastActiveAt: profile.user.lastActiveAt,
    relocationStage: profile.relocationStage,
    relocationStageLabel: stageLabel,
    relocationStageIndex: stageIndex >= 0 ? stageIndex : 0,
    bio: profile.bio,
    certifications,
    lookingForLabel,
    languagesTeaching,
    availableFor,
    interests,
    gallery: profile.images.map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption ?? null,
    })),
    postsCount,
    commentsCount,
    meetupsAttendedCount,
    connectionsCount,
    connectionsPreview,
    mutualConnectionsCount,
    recentActivity,
    targetCountries,
    visibility: profile.visibility,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === "string");
    } catch {
      return [];
    }
  }
  return [];
}

/** Format a date as relative time string */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** Format month/year e.g. "Sep 2024" */
export function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
