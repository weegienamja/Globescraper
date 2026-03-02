import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/rbac";
import { touchLastActive } from "@/lib/last-active";
import { COMMUNITY_COUNTRIES } from "@/lib/validations/community";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recruiter Dashboard | GlobeScraper Community",
  description:
    "Search and discover qualified English teachers across Southeast Asia.",
  robots: { index: false },
};

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

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
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

export default async function RecruiterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["RECRUITER", "ADMIN"]);
  const currentUserId = session.user?.id;
  if (currentUserId) touchLastActive(currentUserId);

  const params = await searchParams;
  const countryFilter = typeof params.country === "string" ? params.country : "";
  const cityFilter = typeof params.city === "string" ? params.city : "";
  const teflOnly = params.tefl === "1";
  const stageFilter = typeof params.stage === "string" ? params.stage : "";

  const where: Record<string, unknown> = {
    displayName: { not: null },
    visibility: { not: "PRIVATE" },
    user: {
      disabled: false,
      role: { in: ["TEACHER", "USER"] },
    },
    hiddenFromCommunity: false,
  };

  if (countryFilter && COUNTRY_ENUM_MAP[countryFilter]) {
    where.targetCountries = {
      some: { country: COUNTRY_ENUM_MAP[countryFilter] },
    };
  }

  if (cityFilter) {
    where.currentCity = { contains: cityFilter };
  }

  if (teflOnly) {
    where.teflTesolCertified = true;
  }

  if (stageFilter && stageFilter in RELOCATION_LABEL) {
    where.relocationStage = stageFilter;
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
      relocationStage: true,
      teflTesolCertified: true,
      certifications: true,
      languagesTeaching: true,
      interests: true,
      user: {
        select: { username: true, lastActiveAt: true, emailVerified: true },
      },
      targetCountries: { select: { country: true } },
    },
  });

  // Recruiter profile info
  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId: currentUserId },
    select: { companyName: true, verifiedCompany: true },
  });

  const resultCount = profiles.length;

  function profileUrl(p: (typeof profiles)[number]): string {
    return `/community/${p.user.username ?? p.userId}`;
  }

  return (
    <div className="recruiter-dashboard">
      <div className="recruiter-dashboard__header">
        <div>
          <h1>Recruiter Dashboard</h1>
          <p className="recruiter-dashboard__sub">
            Find qualified English teachers across Southeast Asia.
            {recruiterProfile?.companyName && (
              <span className="recruiter-dashboard__company">
                {" "}Company: <strong>{recruiterProfile.companyName}</strong>
                {recruiterProfile.verifiedCompany && (
                  <span className="badge badge--ok" style={{ marginLeft: 8 }}>Verified</span>
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search filters */}
      <form method="GET" action="/community/recruiter-dashboard" className="recruiter-filters">
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

        <select name="stage" defaultValue={stageFilter} className="form__input form__input--sm">
          <option value="">Any stage</option>
          {Object.entries(RELOCATION_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <label className="form__checkbox-label form__checkbox-label--inline">
          <input type="checkbox" name="tefl" value="1" defaultChecked={teflOnly} />
          TEFL/TESOL only
        </label>

        <button type="submit" className="btn btn--primary btn--sm">
          Search
        </button>
      </form>

      <p className="recruiter-dashboard__count">
        {resultCount} teacher{resultCount !== 1 ? "s" : ""} found
      </p>

      {/* Results grid */}
      {profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <p className="empty-state__title">No teachers found</p>
          <p className="empty-state__text">
            Try widening your search or check back later as more teachers join.
          </p>
        </div>
      ) : (
        <div className="recruiter-grid">
          {profiles.map((p) => {
            const languages = safeJsonArray(p.languagesTeaching);
            const certs = safeJsonArray(p.certifications);
            const active = timeAgo(p.user.lastActiveAt);

            return (
              <div key={p.userId} className="recruiter-card">
                <div className="recruiter-card__header">
                  <div className="recruiter-card__avatar-wrap">
                    {p.avatarUrl ? (
                      <Image
                        src={p.avatarUrl}
                        alt={p.displayName ?? ""}
                        width={48}
                        height={48}
                        className="recruiter-card__avatar-img"
                      />
                    ) : (
                      <div className="recruiter-card__avatar">
                        {p.displayName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="recruiter-card__info">
                    <h3 className="recruiter-card__name">{p.displayName}</h3>
                    {(p.currentCity || p.currentCountry) && (
                      <p className="recruiter-card__location">
                        {[p.currentCity, p.currentCountry].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <span className="recruiter-card__stage-pill">
                      {RELOCATION_LABEL[p.relocationStage] ?? "Planning"}
                    </span>
                  </div>
                </div>

                {/* Qualifications */}
                <div className="recruiter-card__quals">
                  {p.teflTesolCertified && (
                    <span className="tag tag--cert">TEFL/TESOL</span>
                  )}
                  {certs.length > 0 && certs.map((c) => (
                    <span key={c} className="tag tag--cert">{c}</span>
                  ))}
                  {languages.map((l) => (
                    <span key={l} className="tag tag--lang">{l}</span>
                  ))}
                </div>

                {/* Target countries */}
                {p.targetCountries.length > 0 && (
                  <div className="recruiter-card__countries">
                    {p.targetCountries.map((tc) => (
                      <span key={tc.country} className="tag tag--country">
                        {ENUM_COUNTRY_MAP[tc.country] ?? tc.country}
                      </span>
                    ))}
                  </div>
                )}

                <div className="recruiter-card__footer">
                  <span className="recruiter-card__active">{active}</span>
                  <Link
                    href={profileUrl(p)}
                    className="btn btn--primary btn--sm"
                  >
                    View profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
