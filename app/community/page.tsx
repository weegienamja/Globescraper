import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { COMMUNITY_COUNTRIES, INTENT_LABELS } from "@/lib/validations/community";

export const dynamic = "force-dynamic";

const COUNTRY_ENUM_MAP: Record<string, string> = {
  Vietnam: "VIETNAM",
  Thailand: "THAILAND",
  Cambodia: "CAMBODIA",
  Philippines: "PHILIPPINES",
};

const ENUM_COUNTRY_MAP: Record<string, string> = {
  VIETNAM: "Vietnam",
  THAILAND: "Thailand",
  CAMBODIA: "Cambodia",
  PHILIPPINES: "Philippines",
  INDONESIA: "Indonesia",
  MALAYSIA: "Malaysia",
};

export const metadata = {
  title: "Community",
  description: "Connect with teachers moving to or living in Southeast Asia.",
};

/* ── Invite page for logged-out visitors ──────────────────── */
function CommunityInvite() {
  return (
    <div className="invite-page">
      <div className="invite-hero">
        <span className="invite-hero__emoji">🌏</span>
        <h1 className="invite-hero__title">Join the Community</h1>
        <p className="invite-hero__sub">
          Connect with teachers who are moving to — or already living in — Southeast Asia.
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

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return <CommunityInvite />;

  const params = await searchParams;
  const countryFilter = typeof params.country === "string" ? params.country : "";
  const cityFilter = typeof params.city === "string" ? params.city : "";
  const intentFilter = typeof params.intent === "string" ? params.intent : "";

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

  // Build Prisma where clause
  const where: Record<string, unknown> = {
    displayName: { not: null },
    visibility: { not: "PRIVATE" },
    user: { disabled: false },
    userId: { notIn: Array.from(blockedIds) },
  };

  if (countryFilter && COUNTRY_ENUM_MAP[countryFilter]) {
    where.targetCountries = {
      some: { country: COUNTRY_ENUM_MAP[countryFilter] },
    };
  }

  if (cityFilter) {
    where.currentCity = { contains: cityFilter };
  }

  if (intentFilter && intentFilter in INTENT_LABELS) {
    where[intentFilter] = true;
  }

  const profiles = await prisma.profile.findMany({
    where,
    take: 50,
    orderBy: { updatedAt: "desc" },
    select: {
      userId: true,
      displayName: true,
      avatarUrl: true,
      currentCountry: true,
      currentCity: true,
      meetupCoffee: true,
      meetupCityTour: true,
      meetupJobAdvice: true,
      meetupStudyGroup: true,
      meetupLanguageExchange: true,
      updatedAt: true,
      targetCountries: { select: { country: true } },
    },
  });

  // Check if current user has a community profile
  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  });

  const hasSetup = !!myProfile?.displayName;

  function timeAgo(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "Active today";
    if (days === 1) return "Active yesterday";
    if (days < 7) return `Active ${days}d ago`;
    if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
    return "Active 30d+ ago";
  }

  function getIntents(p: typeof profiles[number]): string[] {
    const intents: string[] = [];
    if (p.meetupCoffee) intents.push("☕ Coffee");
    if (p.meetupCityTour) intents.push("🏙️ City tour");
    if (p.meetupJobAdvice) intents.push("💼 Job advice");
    if (p.meetupStudyGroup) intents.push("📚 Study group");
    if (p.meetupLanguageExchange) intents.push("🗣️ Language exchange");
    return intents;
  }

  return (
    <div className="community-page">
      <div className="community-header">
        <h1>Community</h1>
        <p className="community-header__sub">
          Connect with teachers moving to or living in Southeast Asia.
        </p>
        {hasSetup ? (
          <Link href="/community/edit-profile" className="btn btn--outline btn--sm">
            Edit my profile
          </Link>
        ) : (
          <Link href="/community/edit-profile" className="btn btn--primary btn--sm">
            Set up your community profile
          </Link>
        )}
      </div>

      {/* Filters */}
      <form method="GET" action="/community" className="community-filters">
        <select name="country" defaultValue={countryFilter} className="form__input form__input--sm">
          <option value="">All countries</option>
          {COMMUNITY_COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          name="city"
          type="text"
          placeholder="City..."
          defaultValue={cityFilter}
          className="form__input form__input--sm"
        />

        <select name="intent" defaultValue={intentFilter} className="form__input form__input--sm">
          <option value="">Any interest</option>
          {Object.entries(INTENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <button type="submit" className="btn btn--primary btn--sm">
          Search
        </button>
      </form>

      {/* Results */}
      {profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <p className="empty-state__title">No profiles found</p>
          <p className="empty-state__text">
            Try widening your search or check back later.
          </p>
        </div>
      ) : (
        <div className="community-grid">
          {profiles.map((p) => (
            <Link
              key={p.userId}
              href={`/community/${p.userId}`}
              className="community-card"
            >
              <div className="community-card__header">
                {p.avatarUrl ? (
                  <Image
                    src={p.avatarUrl}
                    alt={p.displayName ?? ""}
                    width={44}
                    height={44}
                    className="community-card__avatar-img"
                  />
                ) : (
                  <div className="community-card__avatar">
                    {p.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div>
                  <h3 className="community-card__name">{p.displayName}</h3>
                  {(p.currentCity || p.currentCountry) && (
                    <p className="community-card__location">
                      📍 {[p.currentCity, p.currentCountry].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {p.targetCountries.length > 0 && (
                <div className="community-card__tags">
                  {p.targetCountries.map((tc) => (
                    <span key={tc.country} className="tag">
                      {ENUM_COUNTRY_MAP[tc.country] ?? tc.country}
                    </span>
                  ))}
                </div>
              )}

              {getIntents(p).length > 0 && (
                <div className="community-card__intents">
                  {getIntents(p).map((i) => (
                    <span key={i} className="intent-badge">{i}</span>
                  ))}
                </div>
              )}

              <p className="community-card__meta">{timeAgo(p.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
