"use client";

import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Constants ────────────────────────────────────────────── */

const COMMUNITY_COUNTRIES = ["Vietnam", "Thailand", "Cambodia", "Philippines"] as const;

/** Major cities per country — covers the main expat / teaching hubs */
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  Vietnam: [
    "Ho Chi Minh City", "Hanoi", "Da Nang", "Nha Trang", "Hoi An",
    "Can Tho", "Hai Phong", "Vung Tau", "Da Lat", "Bien Hoa",
    "Quy Nhon", "Hue", "Phu Quoc",
  ],
  Thailand: [
    "Bangkok", "Chiang Mai", "Phuket", "Pattaya", "Chiang Rai",
    "Koh Samui", "Hua Hin", "Krabi", "Udon Thani", "Khon Kaen",
    "Hat Yai", "Nakhon Ratchasima", "Ayutthaya",
  ],
  Cambodia: [
    "Phnom Penh", "Siem Reap", "Sihanoukville", "Battambang",
    "Kampot", "Kep", "Kampong Cham",
  ],
  Philippines: [
    "Manila", "Makati", "Cebu City", "Davao City", "Quezon City",
    "Taguig", "Angeles City", "Iloilo City", "Bacolod", "Baguio",
    "Dumaguete", "Subic Bay",
  ],
};

/** All cities sorted alphabetically */
const ALL_CITIES = Object.values(CITIES_BY_COUNTRY).flat().sort();

const INTENT_LABELS: Record<string, string> = {
  meetupCoffee: "☕ Coffee meetups",
  meetupCityTour: "🏙️ City tour",
  meetupJobAdvice: "💼 Job advice",
  meetupStudyGroup: "📚 Study group",
  meetupLanguageExchange: "🗣️ Language exchange",
  meetupVisaHelp: "🛂 Visa help chat",
  meetupSchoolReferrals: "🏫 School referrals",
  meetupExploring: "🏛️ Exploring temples",
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

/* ── Types ────────────────────────────────────────────────── */

export interface CommunityProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  currentCountry: string | null;
  currentCity: string | null;
  relocationStage: string;
  teflTesolCertified: boolean;
  meetupCoffee: boolean;
  meetupCityTour: boolean;
  meetupJobAdvice: boolean;
  meetupStudyGroup: boolean;
  meetupLanguageExchange: boolean;
  meetupVisaHelp: boolean;
  meetupSchoolReferrals: boolean;
  interests: unknown;
  languagesTeaching: unknown;
  certifications: unknown;
  updatedAt: string;
  user: {
    username: string | null;
    lastActiveAt: string | null;
    emailVerified: string | null;
    role: string;
  };
  targetCountries: { country: string }[];
}

type SortOption = "relevant" | "active" | "newest";

/* ── Helpers ──────────────────────────────────────────────── */

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
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

function getIntents(p: CommunityProfile): string[] {
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

function profileUrl(p: CommunityProfile): string {
  return `/community/${p.user.username ?? p.userId}`;
}

/* ── Component ────────────────────────────────────────────── */

interface Props {
  profiles: CommunityProfile[];
  hasSetup: boolean;
}

export function CommunityGrid({ profiles, hasSetup }: Props) {
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("relevant");

  // Available cities based on selected country
  const availableCities = useMemo(() => {
    if (countryFilter && CITIES_BY_COUNTRY[countryFilter]) {
      return CITIES_BY_COUNTRY[countryFilter];
    }
    return ALL_CITIES;
  }, [countryFilter]);

  // Clear city when country changes and the city isn't in the new list
  const handleCountryChange = useCallback((country: string) => {
    setCountryFilter(country);
    if (country && CITIES_BY_COUNTRY[country]) {
      if (!CITIES_BY_COUNTRY[country].includes(cityFilter)) {
        setCityFilter("");
      }
    }
  }, [cityFilter]);

  /* Filter + sort on the client */
  const filtered = useMemo(() => {
    let result = [...profiles];

    // Country filter
    if (countryFilter && COUNTRY_ENUM_MAP[countryFilter]) {
      const enumVal = COUNTRY_ENUM_MAP[countryFilter];
      result = result.filter((p) =>
        p.targetCountries.some((tc) => tc.country === enumVal),
      );
    }

    // City filter (case-insensitive contains — matches currentCity)
    if (cityFilter.trim()) {
      const q = cityFilter.trim().toLowerCase();
      result = result.filter(
        (p) => p.currentCity?.toLowerCase().includes(q),
      );
    }

    // Intent filter
    if (intentFilter && intentFilter in INTENT_LABELS) {
      result = result.filter(
        (p) => (p as unknown as Record<string, unknown>)[intentFilter] === true,
      );
    }

    // Sorting
    if (sortBy === "active") {
      result.sort(
        (a, b) =>
          new Date(b.user.lastActiveAt ?? 0).getTime() -
          new Date(a.user.lastActiveAt ?? 0).getTime(),
      );
    } else if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return result;
  }, [profiles, countryFilter, cityFilter, intentFilter, sortBy]);

  /* ── Animation: FLIP + enter/exit ─────────────────────── */
  const gridRef = useRef<HTMLDivElement>(null);
  const prevFilteredRef = useRef<Set<string>>(new Set(profiles.map((p) => p.userId)));
  const rectCacheRef = useRef<Map<string, DOMRect>>(new Map());
  const isFirstRender = useRef(true);

  // Snapshot card positions BEFORE React commits the new DOM
  // We call this synchronously at the top of the effect chain
  useLayoutEffect(() => {
    // On first render, just mark all current cards and skip animation
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevFilteredRef.current = new Set(filtered.map((p) => p.userId));
      return;
    }

    const grid = gridRef.current;
    if (!grid) return;

    const prevIds = prevFilteredRef.current;
    const nextIds = new Set(filtered.map((p) => p.userId));

    // Animate each card
    grid.querySelectorAll<HTMLElement>("[data-profile-id]").forEach((el) => {
      const id = el.dataset.profileId!;
      const oldRect = rectCacheRef.current.get(id);
      const newRect = el.getBoundingClientRect();

      if (!prevIds.has(id)) {
        // ENTERING — slide up + fade in
        el.animate(
          [
            { opacity: 0, transform: "translateY(24px) scale(0.95)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: 350, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "both" },
        );
      } else if (oldRect) {
        // MOVING — FLIP from old position
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 350, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
          );
        }
      }
    });

    prevFilteredRef.current = nextIds;
    rectCacheRef.current.clear();
  }, [filtered]);

  // Snapshot positions before state change triggers re-render
  const snapshotPositions = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const map = new Map<string, DOMRect>();
    grid.querySelectorAll<HTMLElement>("[data-profile-id]").forEach((el) => {
      map.set(el.dataset.profileId!, el.getBoundingClientRect());
    });
    rectCacheRef.current = map;
  }, []);

  // Wrap every filter/sort change with a position snapshot
  const changeCountry = useCallback((v: string) => { snapshotPositions(); handleCountryChange(v); }, [snapshotPositions, handleCountryChange]);
  const changeCity = useCallback((v: string) => { snapshotPositions(); setCityFilter(v); }, [snapshotPositions]);
  const changeIntent = useCallback((v: string) => { snapshotPositions(); setIntentFilter(v); }, [snapshotPositions]);
  const changeSort = useCallback((v: SortOption) => { snapshotPositions(); setSortBy(v); }, [snapshotPositions]);

  return (
    <>
      {/* Filters */}
      <div className="community-filters">
        {hasSetup ? (
          <Link href="/community/edit-profile" className="btn btn--outline btn--sm community-filters__edit">
            Edit my profile
          </Link>
        ) : (
          <Link href="/community/edit-profile" className="btn btn--primary btn--sm community-filters__edit">
            Set up your profile
          </Link>
        )}

        <select
          value={countryFilter}
          onChange={(e) => changeCountry(e.target.value)}
          className="form__input form__input--sm"
        >
          <option value="">All countries</option>
          {COMMUNITY_COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={cityFilter}
          onChange={(e) => changeCity(e.target.value)}
          className="form__input form__input--sm"
        >
          <option value="">All cities</option>
          {availableCities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={intentFilter}
          onChange={(e) => changeIntent(e.target.value)}
          className="form__input form__input--sm"
        >
          <option value="">Any intent</option>
          {Object.entries(INTENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Sort row */}
      <div className="community-sort">
        <span className="community-sort__label">Sort:</span>
        {(["relevant", "active", "newest"] as const).map((s) => (
          <button
            key={s}
            onClick={() => changeSort(s)}
            className={`community-sort__option${sortBy === s ? " community-sort__option--active" : ""}`}
          >
            {s === "relevant" ? "Most relevant" : s === "active" ? "Recently active" : "Newest"}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <p className="empty-state__title">No profiles found</p>
          <p className="empty-state__text">
            Try widening your search or check back later.
          </p>
        </div>
      ) : (
        <div className="community-grid" ref={gridRef}>
          {filtered.map((p) => {
            const languages = safeJsonArray(p.languagesTeaching);
            const intents = getIntents(p);
            const certs = safeJsonArray(p.certifications);
            const active = timeAgo(p.user.lastActiveAt);
            const isOnline = active === "Online now";

            return (
              <Link
                key={p.userId}
                href={profileUrl(p)}
                data-profile-id={p.userId}
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
    </>
  );
}
