"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";

/* ── Static option data ───────────────────────────────────── */

const PROPERTY_TYPES = [
  { value: "", label: "Property Type" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "CONDO", label: "Condo" },
  { value: "SERVICED_APARTMENT", label: "Serviced Apt" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "HOUSE", label: "House" },
  { value: "VILLA", label: "Villa" },
  { value: "TOWNHOUSE", label: "Townhouse" },
];

const PRICE_OPTIONS = buildPriceOptions();

const BED_OPTIONS = [
  { value: "", label: "Min Beds" },
  ...Array.from({ length: 5 }, (_, i) => ({
    value: String(i + 1),
    label: i < 4 ? String(i + 1) : "5+",
  })),
];

const MAX_BED_OPTIONS = [
  { value: "", label: "Max Beds" },
  ...Array.from({ length: 5 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

const BATH_OPTIONS = [
  { value: "", label: "Min Baths" },
  ...Array.from({ length: 4 }, (_, i) => ({
    value: String(i + 1),
    label: i < 3 ? String(i + 1) : "4+",
  })),
];

const MAX_BATH_OPTIONS = [
  { value: "", label: "Max Baths" },
  ...Array.from({ length: 4 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

const SORT_OPTIONS = [
  { value: "", label: "Newest Listed" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "price_desc", label: "Highest Price" },
  { value: "beds_desc", label: "Most Bedrooms" },
];

/* ── Component ────────────────────────────────────────────── */

interface RentalFiltersProps {
  cities: string[];
  districts: string[];
}

export function RentalFilters({ cities, districts }: RentalFiltersProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  /* Measure inner height whenever panel opens */
  useEffect(() => {
    if (panelRef.current) setPanelHeight(panelRef.current.scrollHeight);
  }, [filtersOpen]);

  const apply = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.set("page", "1");
      router.push(`/rentals?${params.toString()}`);
    },
    [router, sp],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    apply({
      city: (fd.get("city") as string) || "",
      district: (fd.get("district") as string) || "",
      type: (fd.get("type") as string) || "",
      beds: (fd.get("beds") as string) || "",
      maxBeds: (fd.get("maxBeds") as string) || "",
      min: (fd.get("min") as string) || "",
      max: (fd.get("max") as string) || "",
      baths: (fd.get("baths") as string) || "",
      maxBaths: (fd.get("maxBaths") as string) || "",
      sort: (fd.get("sort") as string) || "",
    });
  };

  /* Count active extra-panel filters for badge */
  const extraFilterCount = [
    sp.get("baths"),
    sp.get("maxBaths"),
    sp.get("maxBeds"),
    sp.get("sort"),
  ].filter(Boolean).length;

  return (
    <form className="rentals-filters" onSubmit={handleSubmit}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="rentals-filters__bar">
        <select
          name="city"
          className="rentals-filters__select"
          defaultValue={sp.get("city") ?? ""}
          aria-label="Filter by city"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          name="district"
          className="rentals-filters__select"
          defaultValue={sp.get("district") ?? ""}
          aria-label="Filter by district"
        >
          <option value="">All Districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <div className="rentals-filters__pair">
          <select
            name="min"
            className="rentals-filters__select rentals-filters__select--sm"
            defaultValue={sp.get("min") ?? ""}
            aria-label="Minimum price"
          >
            <option value="">Min Price</option>
            {PRICE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <span className="rentals-filters__pair-sep">–</span>
          <select
            name="max"
            className="rentals-filters__select rentals-filters__select--sm"
            defaultValue={sp.get("max") ?? ""}
            aria-label="Maximum price"
          >
            <option value="">Max Price</option>
            {PRICE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="rentals-filters__pair">
          <select
            name="beds"
            className="rentals-filters__select rentals-filters__select--sm"
            defaultValue={sp.get("beds") ?? ""}
            aria-label="Minimum bedrooms"
          >
            {BED_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <span className="rentals-filters__pair-sep">–</span>
          <select
            name="maxBeds"
            className="rentals-filters__select rentals-filters__select--sm"
            defaultValue={sp.get("maxBeds") ?? ""}
            aria-label="Maximum bedrooms"
          >
            {MAX_BED_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        <select
          name="type"
          className="rentals-filters__select"
          defaultValue={sp.get("type") ?? ""}
          aria-label="Filter by property type"
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <button
          type="button"
          className={`rentals-filters__toggle${filtersOpen ? " rentals-filters__toggle--open" : ""}${extraFilterCount > 0 ? " rentals-filters__toggle--active" : ""}`}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="filters-panel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="8" cy="6" r="2" fill="currentColor" />
            <circle cx="16" cy="12" r="2" fill="currentColor" />
            <circle cx="10" cy="18" r="2" fill="currentColor" />
          </svg>
          Filters
          {extraFilterCount > 0 && (
            <span className="rentals-filters__badge">{extraFilterCount}</span>
          )}
          <svg className="rentals-filters__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* ── Collapsible panel ───────────────────────────── */}
      <div
        id="filters-panel"
        className="rentals-filters__panel"
        style={{ maxHeight: filtersOpen ? panelHeight + 32 : 0, opacity: filtersOpen ? 1 : 0 }}
      >
        <div ref={panelRef} className="rentals-filters__panel-inner">
          <div className="rentals-filters__section">
            <h3 className="rentals-filters__section-title">Bathrooms</h3>
            <div className="rentals-filters__pair">
              <select name="baths" className="rentals-filters__select" defaultValue={sp.get("baths") ?? ""} aria-label="Minimum bathrooms">
                {BATH_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              <span className="rentals-filters__pair-sep">–</span>
              <select name="maxBaths" className="rentals-filters__select" defaultValue={sp.get("maxBaths") ?? ""} aria-label="Maximum bathrooms">
                {MAX_BATH_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          <div className="rentals-filters__section">
            <h3 className="rentals-filters__section-title">Sort by</h3>
            <select name="sort" className="rentals-filters__select" defaultValue={sp.get("sort") ?? ""} aria-label="Sort results">
              {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────── */}
      <div className="rentals-filters__actions">
        <button type="button" className="rentals-filters__clear" onClick={() => router.push("/rentals")} aria-label="Clear all filters">
          Clear
        </button>
        <button type="submit" className="rentals-filters__btn" aria-label="Apply filters">
          Search
        </button>
      </div>
    </form>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function buildPriceOptions(): { value: string; label: string }[] {
  const ticks: number[] = [];
  for (let p = 50; p <= 500; p += 50) ticks.push(p);
  for (let p = 600; p <= 1000; p += 100) ticks.push(p);
  for (let p = 1250; p <= 2000; p += 250) ticks.push(p);
  for (let p = 2500; p <= 5000; p += 500) ticks.push(p);
  ticks.push(7500, 10000);
  return ticks.map((p) => ({ value: String(p), label: `$${p.toLocaleString()} pcm` }));
}
