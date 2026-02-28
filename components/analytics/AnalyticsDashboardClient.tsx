"use client";

/**
 * Client-side interactive shell for the analytics dashboard.
 * Receives server-fetched initial data and manages filter state + URL sync.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { KpiCards } from "@/components/analytics/KpiCards";
import { TopMoversTable } from "@/components/analytics/TopMoversTable";

/* ── Dynamic imports (heavy chart components) ────────────── */

const HistoricalHeatmap = dynamic(
  () => import("@/components/analytics/HistoricalHeatmap").then((m) => m.HistoricalHeatmap),
  {
    ssr: false,
    loading: () => (
      <div style={loadingBox(450)}>
        <p style={loadingText}>Loading map...</p>
      </div>
    ),
  },
);

const MedianTrendChart = dynamic(
  () => import("@/components/analytics/MedianTrendChart").then((m) => m.MedianTrendChart),
  {
    ssr: false,
    loading: () => (
      <div style={loadingBox(280)}>
        <p style={loadingText}>Loading chart...</p>
      </div>
    ),
  },
);

const DistributionChart = dynamic(
  () => import("@/components/analytics/DistributionChart").then((m) => m.DistributionChart),
  {
    ssr: false,
    loading: () => (
      <div style={loadingBox(240)}>
        <p style={loadingText}>Loading chart...</p>
      </div>
    ),
  },
);

const MarketPressureChart = dynamic(
  () => import("@/components/analytics/MarketPressureChart").then((m) => m.MarketPressureChart),
  {
    ssr: false,
    loading: () => (
      <div style={loadingBox(260)}>
        <p style={loadingText}>Loading chart...</p>
      </div>
    ),
  },
);

/* ── Shared loading styles ───────────────────────────────── */

function loadingBox(h: number): React.CSSProperties {
  return {
    height: h,
    background: "rgba(15,23,42,0.4)",
    borderRadius: 12,
    border: "1px solid #1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
const loadingText: React.CSSProperties = { fontSize: 14, color: "#64748b" };

/* ── Types ───────────────────────────────────────────────── */

interface AnalyticsPayload {
  summary: {
    currentMedian: number | null;
    current1Bed: number | null;
    current2Bed: number | null;
    totalListings: number;
    change1m: number | null;
    change3m: number | null;
    volatility: number;
    volatilityScore: number;
    supplySignal: "oversupply" | "squeeze" | "neutral";
  };
  trend: {
    date: string;
    median: number | null;
    mean: number | null;
    p25: number | null;
    p75: number | null;
    listingCount: number;
    ma90: number | null;
  }[];
  distribution: {
    label: string;
    min: number;
    max: number;
    count: number;
    percentage: number;
  }[];
  movers: {
    rank: number;
    district: string;
    change1m: number | null;
    change3m: number | null;
    median: number | null;
    volatility: number;
    listingCount: number;
  }[];
  heatmapDistricts?: {
    district: string;
    listingCount: number;
    medianPriceUsd: number | null;
  }[];
  districts?: string[];
  filters: {
    city: string;
    district?: string;
    bedrooms?: number;
    propertyType?: string;
    range: string;
  };
  meta: {
    rowCount: number;
    dateRange: { from: string | null; to: string | null };
  };
}

interface Props {
  initialData: AnalyticsPayload | null;
  districts: string[];
}

type Range = "30d" | "90d" | "180d" | "365d";

/* ── Component ───────────────────────────────────────────── */

export function AnalyticsDashboardClient({ initialData, districts: initialDistricts }: Props) {
  const [data, setData] = useState<AnalyticsPayload | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>(initialDistricts);

  // Filter state
  const [city, setCity] = useState("Phnom Penh");
  const [district, setDistrict] = useState<string>("");
  const [bedrooms, setBedrooms] = useState<string>("");
  const [propertyType, setPropertyType] = useState<string>("");
  const [range, setRange] = useState<Range>("90d");

  // Reset district filter when city changes
  const handleCityChange = useCallback((newCity: string) => {
    setCity(newCity);
    setDistrict("");
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("city", city);
    if (district) params.set("district", district);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (propertyType) params.set("propertyType", propertyType);
    params.set("range", range);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [city, district, bedrooms, propertyType, range]);

  // Read URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("city")) setCity(params.get("city")!);
    if (params.get("district")) setDistrict(params.get("district")!);
    if (params.get("bedrooms")) setBedrooms(params.get("bedrooms")!);
    if (params.get("propertyType")) setPropertyType(params.get("propertyType")!);
    if (params.get("range")) setRange(params.get("range") as Range);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ city, range });
      if (district) params.set("district", district);
      if (bedrooms) params.set("bedrooms", bedrooms);
      if (propertyType) params.set("propertyType", propertyType);
      const res = await fetch(`/api/tools/rentals/analytics?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      // Update district list from API response
      if (json.districts) {
        setAvailableDistricts(json.districts);
      }
    } catch (e) {
      console.error("Analytics fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [city, district, bedrooms, propertyType, range]);

  // Refetch when filters change — skip only the very first render
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      // Only fetch on mount if there's no server-provided data
      if (!initialData) fetchData();
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, district, bedrooms, propertyType, range]);

  const handleExportCsv = () => {
    const params = new URLSearchParams({ city, range, format: "csv" });
    if (district) params.set("district", district);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (propertyType) params.set("propertyType", propertyType);
    window.open(`/api/tools/rentals/analytics?${params}`, "_blank");
  };

  // Transform district data for heatmap — prefer full heatmapDistricts, fallback to movers
  const heatmapData = useMemo(() => {
    if (!data) return [];
    // Use heatmapDistricts (all districts, no cap) when available
    if (data.heatmapDistricts && data.heatmapDistricts.length > 0) {
      return data.heatmapDistricts.map((d) => ({
        district: d.district,
        city: city,
        bedrooms: null as number | null,
        propertyType: "ALL",
        listingCount: d.listingCount,
        medianPriceUsd: d.medianPriceUsd,
        p25PriceUsd: null as number | null,
        p75PriceUsd: null as number | null,
      }));
    }
    // Fallback to movers (legacy, capped at 20)
    return data.movers.map((m) => ({
      district: m.district,
      city: city,
      bedrooms: null as number | null,
      propertyType: "ALL",
      listingCount: m.listingCount,
      medianPriceUsd: m.median,
      p25PriceUsd: null as number | null,
      p75PriceUsd: null as number | null,
    }));
  }, [data, city]);

  // Compute data age in days (for staleness warning)
  const dataAge = useMemo(() => {
    if (!data?.meta.dateRange.to) return 0;
    const lastDate = new Date(data.meta.dateRange.to + "T00:00:00Z");
    return Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  }, [data]);

  return (
    <div style={{ minHeight: "100vh", background: "#020617" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ── Header ──────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Rental Market Analytics</h1>
            <p style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>
              {data?.meta.dateRange.from && data?.meta.dateRange.to
                ? `${data.meta.dateRange.from} to ${data.meta.dateRange.to}`
                : "Loading..."}{" "}
              | {data?.meta.rowCount ?? 0} index rows
            </p>
            <p style={{ marginTop: 6, fontSize: 12, color: "#475569", maxWidth: 700, lineHeight: 1.5 }}>
              Aggregated rental intelligence derived from the RentalIndexDaily pipeline.
              Statistics are computed from scraped listing snapshots, grouped by city, district,
              bedrooms, and property type. Use the filters to drill into specific segments.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={handleExportCsv} style={btnStyle}>Export CSV</button>
            <button onClick={fetchData} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.5 : 1 }}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, borderRadius: 12, border: "1px solid #1e293b", background: "rgba(15,23,42,0.4)", padding: 16 }}>
          <FilterGroup label="City">
            <select value={city} onChange={(e) => handleCityChange(e.target.value)} style={selectStyle}>
              <option>Phnom Penh</option>
              <option>Siem Reap</option>
              <option>Sihanoukville</option>
              <option>Kampot</option>
            </select>
          </FilterGroup>
          <FilterGroup label="District">
            <select value={district} onChange={(e) => setDistrict(e.target.value)} style={selectStyle}>
              <option value="">All Districts</option>
              {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Bedrooms">
            <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={selectStyle}>
              <option value="">All</option>
              <option value="1">1 Bed</option>
              <option value="2">2 Bed</option>
              <option value="3">3 Bed</option>
              <option value="4">4+ Bed</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Type">
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={selectStyle}>
              <option value="">All Types</option>
              <option value="CONDO">Condo</option>
              <option value="APARTMENT">Apartment</option>
              <option value="SERVICED_APARTMENT">Serviced Apt</option>
              <option value="PENTHOUSE">Penthouse</option>
              <option value="OTHER">Other</option>
            </select>
          </FilterGroup>
          <FilterGroup label="Range">
            <div style={rangeGroupStyle}>
              {(["30d", "90d", "180d", "365d"] as Range[]).map((r) => (
                <button key={r} onClick={() => setRange(r)} style={rangeBtn(range === r)}>{r}</button>
              ))}
            </div>
          </FilterGroup>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#64748b" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #334155", borderTopColor: "#3b82f6", animation: "spin 1s linear infinite" }} />
            Fetching analytics data...
          </div>
        )}

        {data && (
          <>
            {/* ── Data freshness warning ─────────────── */}
            {dataAge > 3 && (
              <div style={warningBanner}>
                ⚠️ Data may be stale — the most recent index data is from <strong>{data.meta.dateRange.to}</strong> ({dataAge} days ago).
                Run <code style={{ fontSize: 11, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>npx tsx scripts/rentals_build_index.ts</code> to rebuild.
              </div>
            )}

            {/* ── KPI Cards ───────────────────────────── */}
            <div>
              <div style={sectionExplainer}>
                <h2 style={{ ...sectionTitle, marginBottom: 4 }}>Key Metrics</h2>
                <p style={explainerText}>
                  Snapshot of the current rental market. <strong>Median Rent</strong> is the listing-weighted
                  middle price across all active listings. <strong>1M %</strong> shows the month-over-month
                  change. <strong>Volatility</strong> (0–100) measures price stability using the coefficient of
                  variation — under 20 is stable, over 50 is high. <strong>Supply Pressure</strong> compares
                  the last 2 weeks of listing counts and prices to the prior 2 weeks.
                </p>
              </div>
              <KpiCards summary={data.summary} />
            </div>

            {/* ── Main Grid ───────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
              {/* Heatmap */}
              <div style={panelStyle}>
                <h2 style={sectionTitle}>District Heatmap</h2>
                <p style={explainerText}>
                  Median rental price by district, color-coded from green (lowest) to red (highest).
                  Hover over a district to see its median price and listing count.
                </p>
                <HistoricalHeatmap data={heatmapData} height={420} city={city} />
              </div>
              {/* Distribution */}
              <div style={panelStyle}>
                <h2 style={sectionTitle}>Price Distribution</h2>
                <p style={explainerText}>
                  How listings are spread across price brackets on the most recent index date.
                  Each bar shows the percentage of total listings falling in that range.
                </p>
                <DistributionChart data={data.distribution} />
              </div>
            </div>

            {/* ── Trend + Pressure ────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={panelStyle}>
                <h2 style={sectionTitle}>Median Trend</h2>
                <p style={explainerText}>
                  Monthly median rental price with a 90-day moving average (dashed line).
                  Switch between median, mean, P25, and P75 metrics using the buttons above the chart.
                  Bars are color-coded: green (&lt;$300), blue ($300–600), amber ($600–1 k), red (&gt;$1 k).
                </p>
                <MedianTrendChart data={data.trend} />
              </div>
              <div style={panelStyle}>
                <h2 style={sectionTitle}>Market Pressure</h2>
                <p style={explainerText}>
                  Overlays median price (blue line) and listing count (purple area) to reveal
                  supply/demand dynamics. Rising count + falling price = oversupply;
                  falling count + rising price = demand squeeze.
                </p>
                <MarketPressureChart data={data.trend} supplySignal={data.summary.supplySignal} />
              </div>
            </div>

            {/* ── Top Movers ──────────────────────────── */}
            <div style={panelStyle}>
              <h2 style={sectionTitle}>Top Market Movers</h2>
              <p style={explainerText}>
                Districts ranked by the largest absolute 1-month price change. Click column
                headers to re-sort. <strong>Vol.</strong> is the standard deviation of daily median
                prices — higher values mean more price fluctuation in that district.
              </p>
              <TopMoversTable data={data.movers} />
            </div>
          </>
        )}
      </div>

      {/* Spin animation for loading indicator */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Shared inline style constants ───────────────────────── */

const btnStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0f172a",
  padding: "8px 16px",
  fontSize: 11,
  fontWeight: 500,
  color: "#cbd5e1",
  cursor: "pointer",
  transition: "all 0.15s",
};

const selectStyle: React.CSSProperties = {
  display: "block",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0f172a",
  padding: "6px 12px",
  fontSize: 11,
  color: "#e2e8f0",
  outline: "none",
};

const rangeGroupStyle: React.CSSProperties = {
  display: "flex",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0f172a",
  padding: 2,
};

function rangeBtn(active: boolean): React.CSSProperties {
  return {
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
    background: active ? "#334155" : "transparent",
    color: active ? "#e2e8f0" : "#64748b",
  };
}

const panelStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid #1e293b",
  background: "rgba(15,23,42,0.4)",
  padding: 20,
};

const sectionTitle: React.CSSProperties = {
  marginBottom: 16,
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
};

const explainerText: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 12,
  lineHeight: 1.6,
  color: "#64748b",
};

const sectionExplainer: React.CSSProperties = {
  marginBottom: 12,
};

const warningBanner: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid #92400e",
  background: "rgba(146,64,14,0.12)",
  padding: "12px 16px",
  fontSize: 12,
  lineHeight: 1.6,
  color: "#fbbf24",
};

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
