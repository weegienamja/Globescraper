"use client";

import { useState, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Constants (mirrored from server for client use) ──────── */

const COMMUNITY_COUNTRIES = ["Vietnam", "Thailand", "Cambodia", "Philippines"] as const;

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
  updatedAt: string;  // serialised Date
  user: {
    username: string | null;
    lastActiveAt: string | null;
    emailVerified: string | null; // serialised Date | null
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

  /* Debounce city typed input 300ms */
  const cityTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedCity, setDebouncedCity] = useState("");

  const handleCityChange = useCallback((val: string) => {
    setCityFilter(val);
    if (cityTimeout.current) clearTimeout(cityTimeout.current);
    cityTimeout.current = setTimeout(() => setDebouncedCity(val), 300);
  }, []);

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

    // City filter (case-insensitive contains)
    if (debouncedCity.trim()) {
      const q = debouncedCity.trim().toLowerCase();
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
    // "relevant" = default DB order

    return result;
  }, [profiles, countryFilter, debouncedCity, intentFilter, sortBy]);

  /* Track which profile IDs are currently visible for animation */
  const visibleIds = useMemo(() => new Set(filtered.map((p) => p.userId)), [filtered]);

  /* FLIP animation: remember grid positions before render */
  const gridRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<string, DOMRect>>(new Map());

  // Capture positions before DOM update
  const capturePositions = useCallback(() => {
    if (!gridRef.current) return;
    const map = new Map<string, DOMRect>();
    gridRef.current.querySelectorAll<HTMLElement>("[data-profile-id]").forEach((el) => {
      const id = el.dataset.profileId!;
      map.set(id, el.getBoundingClientRect());
    });
    positionsRef.current = map;
  }, []);

  // Before every re-render where filters change, snapshot positions
  // We do this eagerly on filter change
  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (val: string) => {
      capturePositions();
      setter(val);
    },
    [capturePositions],
  );

  // After render, animate from old position to new position (FLIP)
  useLayoutEffect(() => {
    if (!gridRef.current) return;
    const oldPositions = positionsRef.current;
    if (oldPositions.size === 0) return;

    gridRef.current.querySelectorAll<HTMLElement>("[data-profile-id]").forEach((el) => {
      const id = el.dataset.profileId!;
      const oldRect = oldPositions.get(id);
      const newRect = el.getBoundingClientRect();

      if (oldRect) {
        // Element existed before — animate from old position
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (dx !== 0 || dy !== 0) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = "none";
          // Force reflow
          el.getBoundingClientRect();
          el.style.transform = "";
          el.style.transition = "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease";
        }
      } else {
        // New element entering – fade + slide up
        el.style.opacity = "0";
        el.style.transform = "translateY(16px) scale(0.97)";
        el.style.transition = "none";
        el.getBoundingClientRect();
        el.style.opacity = "1";
        el.style.transform = "";
        el.style.transition = "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease";
      }
    });

    positionsRef.current = new Map();
  }, [filtered]);

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
          onChange={(e) => {
            capturePositions();
            setCountryFilter(e.target.value);
          }}
          className="form__input form__input--sm"
        >
          <option value="">All countries</option>
          {COMMUNITY_COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="City..."
          value={cityFilter}
          onChange={(e) => {
            capturePositions();
            handleCityChange(e.target.value);
          }}
          className="form__input form__input--sm"
        />

        <select
          value={intentFilter}
          onChange={(e) => {
            capturePositions();
            setIntentFilter(e.target.value);
          }}
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
            onClick={() => {
              capturePositions();
              setSortBy(s);
            }}
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
          {profiles.map((p) => {
            const show = visibleIds.has(p.userId);
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
                className={`community-card community-card--animated${show ? " community-card--visible" : ""}`}
                tabIndex={show ? 0 : -1}
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
    </>
  );
}
