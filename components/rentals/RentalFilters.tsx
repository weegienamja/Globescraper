"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import { ADVANCED_PARAM_KEYS, ALL_PARAM_KEYS, AMENITY_PARAM_KEYS } from "@/lib/rentalsQuery";
import { FILTERABLE_FACILITIES, FILTERABLE_AMENITIES } from "@/lib/amenityClassification";

/* ================================================================
   Static option data
   ================================================================ */

// -- Quick filter options --

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

// bedsMin: single selector => bedrooms >= N
const BED_OPTIONS = [
  { value: "", label: "Any Beds" },
  { value: "0", label: "Studio" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
  { value: "5", label: "5+" },
];

// sort: controls orderBy on the server
const SORT_OPTIONS = [
  { value: "", label: "Newest Listed" },
  { value: "updated", label: "Recently Updated" },
  { value: "price_asc", label: "Price Low to High" },
  { value: "price_desc", label: "Price High to Low" },
  { value: "size_desc", label: "Size Large to Small" },
];

// -- Advanced filter options --

const BATH_MIN_OPTIONS = [
  { value: "", label: "Min Baths" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4+" },
];

const BATH_MAX_OPTIONS = [
  { value: "", label: "Max Baths" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

// dateAdded: filter by firstSeenAt window
const DATE_ADDED_OPTIONS = [
  { value: "", label: "Anytime" },
  { value: "24h", label: "Last 24 hours" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "1m", label: "Last month" },
];

/* ================================================================
   Component
   ================================================================ */

interface RentalFiltersProps {
  /** Distinct city values from DB */
  cities: string[];
  /** Distinct district values from DB (for the selected city, or all) */
  districts: string[];
}

export function RentalFilters({ cities, districts }: RentalFiltersProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [advOpen, setAdvOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  // Re-measure expandable panel height when it opens or re-renders
  useEffect(() => {
    if (panelRef.current) setPanelHeight(panelRef.current.scrollHeight);
  }, [advOpen]);

  /* ----- Helpers to read / write URL search params ----- */

  const apply = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      // Always reset to page 1 when filters change
      params.set("page", "1");
      router.push(`/rentals?${params.toString()}`);
    },
    [router, sp],
  );

  // Collect every named input in the form and push to URL
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const overrides: Record<string, string> = {};
    // Quick filters
    for (const key of [
      "city", "district", "minPrice", "maxPrice",
      "bedsMin", "propertyType", "sort",
    ]) {
      overrides[key] = (fd.get(key) as string) || "";
    }
    // Advanced filters
    for (const key of ADVANCED_PARAM_KEYS) {
      overrides[key] = (fd.get(key) as string) || "";
    }
    // Amenity / facility checkboxes (each is a separate param key)
    for (const key of AMENITY_PARAM_KEYS) {
      overrides[key] = fd.has(key) ? "1" : "";
    }
    apply(overrides);
  };

  /* ----- Clear handlers ----- */

  // Clear All: wipe every filter and reset page
  const clearAll = () => router.push("/rentals");

  // Clear Advanced: remove only advanced params, keep quick filters
  const clearAdvanced = () => {
    const params = new URLSearchParams(sp.toString());
    for (const key of ADVANCED_PARAM_KEYS) params.delete(key);
    params.set("page", "1");
    router.push(`/rentals?${params.toString()}`);
  };

  /* ----- Active advanced filter count for badge -----
     Counts non-empty advanced params. "available" defaults to on
     so we only count it if it is explicitly "1". dateAdded only
     counts if not "" (Anytime). */
  const advancedFilterCount = ADVANCED_PARAM_KEYS.filter((key) => {
    const v = sp.get(key);
    if (!v) return false;
    if (key === "dateAdded" && v === "anytime") return false;
    return true;
  }).length;

  return (
    <form className="rentals-filters" onSubmit={handleSubmit}>
      {/* ============================================================
          ROW 1: City, District, Min Price, Max Price
          ============================================================ */}
      <div className="rentals-filters__bar">
        {/* city -> RentalListing.city exact match */}
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

        {/* district -> RentalListing.district exact match */}
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

        {/* minPrice / maxPrice -> priceMonthlyUsd range */}
        <select
          name="minPrice"
          className="rentals-filters__select"
          defaultValue={sp.get("minPrice") ?? ""}
          aria-label="Minimum price"
        >
          <option value="">Min Price</option>
          {PRICE_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <select
          name="maxPrice"
          className="rentals-filters__select"
          defaultValue={sp.get("maxPrice") ?? ""}
          aria-label="Maximum price"
        >
          <option value="">Max Price</option>
          {PRICE_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* ============================================================
          ROW 2: Beds, Property Type, Sort By, Filters toggle, actions
          ============================================================ */}
      <div className="rentals-filters__bar rentals-filters__bar--row2">
        {/* bedsMin -> bedrooms >= N */}
        <select
          name="bedsMin"
          className="rentals-filters__select"
          defaultValue={sp.get("bedsMin") ?? ""}
          aria-label="Minimum bedrooms"
        >
          {BED_OPTIONS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>

        {/* propertyType -> propertyType enum */}
        <select
          name="propertyType"
          className="rentals-filters__select"
          defaultValue={sp.get("propertyType") ?? ""}
          aria-label="Filter by property type"
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* sort -> orderBy clause (see lib/rentalsQuery.ts) */}
        <select
          name="sort"
          className="rentals-filters__select"
          defaultValue={sp.get("sort") ?? ""}
          aria-label="Sort results"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Advanced Filters toggle */}
        <button
          type="button"
          className={
            "rentals-filters__toggle"
            + (advOpen ? " rentals-filters__toggle--open" : "")
            + (advancedFilterCount > 0 ? " rentals-filters__toggle--active" : "")
          }
          onClick={() => setAdvOpen((v) => !v)}
          aria-expanded={advOpen}
          aria-controls="adv-filters-panel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="8" cy="6" r="2" fill="currentColor" />
            <circle cx="16" cy="12" r="2" fill="currentColor" />
            <circle cx="10" cy="18" r="2" fill="currentColor" />
          </svg>
          {/* Show count only when advanced filters are active */}
          {advancedFilterCount > 0 ? `Filters (${advancedFilterCount})` : "Filters"}
          <svg className="rentals-filters__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Actions: right-aligned on desktop */}
        <div className="rentals-filters__actions">
          <button
            type="button"
            className="rentals-filters__clear"
            onClick={clearAll}
            aria-label="Clear all filters"
          >
            Clear All
          </button>
          <button type="submit" className="rentals-filters__btn" aria-label="Apply filters">
            Search
          </button>
        </div>
      </div>

      {/* ============================================================
          ADVANCED FILTERS panel (collapsible)
          ============================================================ */}
      <div
        id="adv-filters-panel"
        className="rentals-filters__panel"
        style={{
          maxHeight: advOpen ? panelHeight + 40 : 0,
          opacity: advOpen ? 1 : 0,
        }}
      >
        <div ref={panelRef} className="rentals-filters__panel-inner">
          <h3 className="rentals-filters__panel-heading">Advanced Filters</h3>

          <div className="rentals-filters__adv-grid">
            {/* ---------- Left column ---------- */}
            <div className="rentals-filters__adv-col">
              {/* Bathrooms: bathsMin / bathsMax -> bathrooms range */}
              <div className="rentals-filters__section">
                <h4 className="rentals-filters__section-title">Bathrooms</h4>
                <div className="rentals-filters__pair">
                  <select name="bathsMin" className="rentals-filters__select" defaultValue={sp.get("bathsMin") ?? ""} aria-label="Minimum bathrooms">
                    {BATH_MIN_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <span className="rentals-filters__pair-sep">-</span>
                  <select name="bathsMax" className="rentals-filters__select" defaultValue={sp.get("bathsMax") ?? ""} aria-label="Maximum bathrooms">
                    {BATH_MAX_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Date added: dateAdded -> firstSeenAt >= cutoff */}
              <div className="rentals-filters__section">
                <h4 className="rentals-filters__section-title">Date added</h4>
                <select name="dateAdded" className="rentals-filters__select" defaultValue={sp.get("dateAdded") ?? ""} aria-label="Date added filter">
                  {DATE_ADDED_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {/* ---------- Right column ---------- */}
            <div className="rentals-filters__adv-col">
              {/* Size (sqm): sizeMin / sizeMax -> sizeSqm range */}
              <div className="rentals-filters__section">
                <h4 className="rentals-filters__section-title">Size (sqm)</h4>
                <div className="rentals-filters__pair">
                  <input
                    name="sizeMin"
                    type="number"
                    min="0"
                    className="rentals-filters__input"
                    placeholder="Min Size"
                    defaultValue={sp.get("sizeMin") ?? ""}
                    aria-label="Minimum size in sqm"
                  />
                  <span className="rentals-filters__pair-sep">sqm</span>
                  <span className="rentals-filters__pair-sep">-</span>
                  <input
                    name="sizeMax"
                    type="number"
                    min="0"
                    className="rentals-filters__input"
                    placeholder="Max Size"
                    defaultValue={sp.get("sizeMax") ?? ""}
                    aria-label="Maximum size in sqm"
                  />
                  <span className="rentals-filters__pair-sep">sqm</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- Must-have Facilities (full width) ---------- */}
          <div className="rentals-filters__section">
            <h4 className="rentals-filters__section-title">Must-have Facilities</h4>
            <div className="rentals-filters__checkbox-grid">
              {FILTERABLE_FACILITIES.map((name) => {
                const key = amenityKey(name);
                return (
                  <label key={key} className="rentals-filters__checkbox">
                    <input type="checkbox" name={key} value="1" defaultChecked={sp.get(key) === "1"} />
                    {name}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ---------- Must-have Amenities (full width) ---------- */}
          <div className="rentals-filters__section">
            <h4 className="rentals-filters__section-title">Must-have Amenities</h4>
            <div className="rentals-filters__checkbox-grid">
              {FILTERABLE_AMENITIES.map((name) => {
                const key = amenityKey(name);
                return (
                  <label key={key} className="rentals-filters__checkbox">
                    <input type="checkbox" name={key} value="1" defaultChecked={sp.get(key) === "1"} />
                    {name}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Advanced panel footer actions */}
          <div className="rentals-filters__adv-actions">
            <button
              type="button"
              className="rentals-filters__clear rentals-filters__clear--small"
              onClick={clearAdvanced}
              aria-label="Clear advanced filters only"
            >
              Clear Advanced
            </button>
            <button
              type="button"
              className="rentals-filters__clear"
              onClick={clearAll}
              aria-label="Clear all filters"
            >
              Clear All
            </button>
            <button type="submit" className="rentals-filters__btn" aria-label="Apply filters">
              Search
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ================================================================
   Price option builder
   $50 increments up to $500, then $100 to $1000, $250 to $2000,
   $500 to $5000, then $7500 and $10000.
   ================================================================ */

function buildPriceOptions(): { value: string; label: string }[] {
  const ticks: number[] = [];
  for (let p = 50; p <= 500; p += 50) ticks.push(p);
  for (let p = 600; p <= 1000; p += 100) ticks.push(p);
  for (let p = 1250; p <= 2000; p += 250) ticks.push(p);
  for (let p = 2500; p <= 5000; p += 500) ticks.push(p);
  ticks.push(7500, 10000);
  return ticks.map((p) => ({
    value: String(p),
    label: `$${p.toLocaleString()} pcm`,
  }));
}

/**
 * Convert a human amenity name like "Swimming Pool" to a URL-safe
 * param key like "f_swimmingPool".
 */
function amenityKey(name: string): string {
  const camel = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  return `f_${camel}`;
}
