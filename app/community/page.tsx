import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { COMMUNITY_COUNTRIES, INTENT_LABELS } from "@/lib/validations/community";
import { touchLastActive } from "@/lib/last-active";
import { needsOnboarding, isRecruiter } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const COUNTRY_ENUM_MAP: Record<string, string> = {
  Vietnam: "VIETNAM",
  Thailand: "THAILAND",
  Cambodia: "CAMBODIA",
  Philippines: "PHILIPPINES",
  Indonesia: "INDONESIA",
  Malaysia: "MALAYSIA",
};

const ENUM_COUNTRY_MAP: Record<string, string> = {
  VIETNAM: "Vietnam",
  THAILAND: "Thailand",
  CAMBODIA: "Cambodia",
  PHILIPPINES: "Philippines",
  INDONESIA: "Indonesia",
  MALAYSIA: "Malaysia",
};

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

type SortOption = "relevant" | "active" | "newest";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return <CommunityInvite />;

  // Role-based redirects
  const userRole = session.user.role;
  if (needsOnboarding(userRole)) redirect("/onboarding/who-are-you");
  if (isRecruiter(userRole)) redirect("/community/recruiter-dashboard");

  // Fire-and-forget last active update
  touchLastActive(session.user.id);

  const params = await searchParams;
  const countryFilter = typeof params.country === "string" ? params.country : "";
  const cityFilter = typeof params.city === "string" ? params.city : "";
  const intentFilter = typeof params.intent === "string" ? params.intent : "";
  const sortBy = (typeof params.sort === "string" ? params.sort : "relevant") as SortOption;

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

  // Only show teacher + student profiles
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

  // Sorting
  let orderBy: Record<string, string> = { updatedAt: "desc" };
  if (sortBy === "active") orderBy = { updatedAt: "desc" };
  else if (sortBy === "newest") orderBy = { createdAt: "desc" };

  const profiles = await prisma.profile.findMany({
    where,
    take: 50,
    orderBy,
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

  function getIntents(p: typeof profiles[number]): string[] {
    const intents: string[] = [];
    if (p.meetupCoffee) intents.push("Coffee meetups");
    if (p.meetupCityTour) intents.push("City tour");
    if (p.meetupJobAdvice) intents.push("Job advice");
    if (p.meetupStudyGroup) intents.push("Study group");
    if (p.meetupLanguageExchange) intents.push("Language exchange");
    if (p.meetupVisaHelp) intents.push("Visa help chat");
    if (p.meetupSchoolReferrals) intents.push("School referrals");
    return intents;
  }

  function safeJsonArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
    return [];
  }

  function profileUrl(p: typeof profiles[number]): string {
    return `/community/${p.user.username ?? p.userId}`;
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
        {/* Main column */}
        <div className="community-layout__main">
          {/* Filters */}
          <form method="GET" action="/community" className="community-filters">
            {hasSetup ? (
              <Link href="/community/edit-profile" className="btn btn--outline btn--sm community-filters__edit">
                Edit my profile
              </Link>
            ) : (
              <Link href="/community/edit-profile" className="btn btn--primary btn--sm community-filters__edit">
                Set up your profile
              </Link>
            )}

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
              <option value="">Any intent</option>
              {Object.entries(INTENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <button type="submit" className="btn btn--primary btn--sm">
              Search
            </button>
          </form>

          {/* Sort row */}
          <div className="community-sort">
            <span className="community-sort__label">Sort:</span>
            {(["relevant", "active", "newest"] as const).map((s) => (
              <Link
                key={s}
                href={`/community?sort=${s}${countryFilter ? `&country=${countryFilter}` : ""}${cityFilter ? `&city=${cityFilter}` : ""}${intentFilter ? `&intent=${intentFilter}` : ""}`}
                className={`community-sort__option ${sortBy === s ? "community-sort__option--active" : ""}`}
              >
                {s === "relevant" ? "Most relevant" : s === "active" ? "Recently active" : "Newest"}
              </Link>
            ))}
          </div>

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
              {profiles.map((p) => {
                const languages = safeJsonArray(p.languagesTeaching);
                const intents = getIntents(p);
                const certs = safeJsonArray(p.certifications);
                const active = timeAgo(p.user.lastActiveAt);
                const isOnline = active === "Online now";

                return (
                  <Link
                    key={p.userId}
                    href={profileUrl(p)}
                    className="community-card"
                    tabIndex={0}
                  >
                    <div className="community-card__header">
                      <div className="community-card__avatar-wrap">
                        {p.avatarUrl ? (
                          <Image
                            src={p.avatarUrl}
                            alt={p.displayName ?? ""}
                            width={48}
                            height={48}
                            className="community-card__avatar-img"
                          />
                        ) : (
                          <div className="community-card__avatar">
                            {p.displayName?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        {p.user.emailVerified && (
                          <span className="community-card__verified" title="Verified">✓</span>
                        )}
                        {isOnline && <span className="community-card__online-dot" />}
                      </div>
                      <div className="community-card__info">
                        <div className="community-card__name-row">
                          <h3 className="community-card__name">{p.displayName}</h3>
                          <span className="community-card__stage-pill">
                            {RELOCATION_LABEL[p.relocationStage] ?? "Planning"}
                          </span>
                        </div>
                        {(p.currentCity || p.currentCountry) && (
                          <p className="community-card__location">
                            📍 {[p.currentCity, p.currentCountry].filter(Boolean).join(", ")}
                          </p>
                        )}
                        <p className="community-card__active">{active}</p>
                      </div>
                    </div>

                    {/* Language + certs row */}
                    {(languages.length > 0 || certs.length > 0) && (
                      <div className="community-card__tags">
                        {languages.map((l) => (
                          <span key={l} className="tag tag--lang">{l}</span>
                        ))}
                        {certs.length > 0 && (
                          <span className="tag tag--cert">{certs[0]} Certified</span>
                        )}
                      </div>
                    )}

                    {/* Available for chips */}
                    {intents.length > 0 && (
                      <div className="community-card__intents">
                        {intents.slice(0, 4).map((i) => (
                          <span key={i} className="intent-badge">{i}</span>
                        ))}
                        {intents.length > 4 && (
                          <span className="intent-badge intent-badge--more">...</span>
                        )}
                      </div>
                    )}

                    {/* Target countries */}
                    {p.targetCountries.length > 0 && (
                      <div className="community-card__countries">
                        {p.targetCountries.map((tc) => (
                          <span key={tc.country} className="tag tag--country">
                            {ENUM_COUNTRY_MAP[tc.country] ?? tc.country}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
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
