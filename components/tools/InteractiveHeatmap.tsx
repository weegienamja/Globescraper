"use client";

import React, { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ── Types ───────────────────────────────────────────────── */

export interface DistrictIndexRow {
  district: string | null;
  city?: string | null;
  bedrooms: number | null;
  propertyType: string;
  listingCount: number;
  medianPriceUsd: number | null;
  p25PriceUsd: number | null;
  p75PriceUsd: number | null;
}

/** Aggregated per-district data for map display */
interface DistrictSummary {
  district: string;
  city: string;
  totalListings: number;
  medianPrice: number | null;
  types: string[];
  coords: [number, number];
}

/* ── District coordinates ────────────────────────────────── */
/* Approximate centre-points for known districts. */

const DISTRICT_COORDS: Record<string, [number, number]> = {
  // Phnom Penh
  "BKK1":            [11.5563, 104.9282],
  "BKK2":            [11.5490, 104.9240],
  "BKK3":            [11.5455, 104.9170],
  "Tonle Bassac":    [11.5510, 104.9350],
  "Chamkarmon":      [11.5530, 104.9280],
  "Toul Kork":       [11.5780, 104.9020],
  "Toul Tom Poung":  [11.5440, 104.9200],
  "Daun Penh":       [11.5720, 104.9210],
  "7 Makara":        [11.5650, 104.9100],
  "Sen Sok":         [11.5950, 104.8700],
  "Chroy Changvar":  [11.5920, 104.9400],
  "Meanchey":        [11.5180, 104.9180],
  "Chbar Ampov":     [11.5250, 104.9500],
  "Por Sen Chey":    [11.5350, 104.8500],
  "Russey Keo":      [11.6050, 104.9100],
  "Stung Meanchey":  [11.5130, 104.9100],
  "Dangkao":         [11.4900, 104.8800],
  "Prek Pnov":       [11.6400, 104.8900],
  "Kamboul":         [11.5350, 104.8200],

  // Siem Reap
  "Sala Kamraeuk":   [13.3622, 103.8600],
  "Svay Dangkum":    [13.3450, 103.8680],
  "Slorkram":        [13.3500, 103.8520],
  "Siem Reap":       [13.3633, 103.8564],
  "Kouk Chak":       [13.3850, 103.8560],
  "Sla Kram":        [13.3700, 103.8400],

  // Sihanoukville
  "Sihanoukville":   [10.6093, 103.5296],
  "Mittapheap":      [10.6160, 103.5210],
  "Commune 4":       [10.6300, 103.5100],

  // Kampot
  "Kampot":          [10.5940, 104.1700],

  // Battambang
  "Battambang":      [13.1023, 103.1990],

  // Kep
  "Kep":             [10.4830, 104.2930],
};

/** City-centre fallbacks */
const CITY_CENTERS: Record<string, [number, number]> = {
  "Phnom Penh":     [11.5564, 104.9282],
  "Siem Reap":     [13.3633, 103.8564],
  "Sihanoukville": [10.6093, 103.5296],
  "Kampot":        [10.5940, 104.1700],
  "Battambang":    [13.1023, 103.1990],
  "Kep":           [10.4830, 104.2930],
};

/* ── Colour helpers ──────────────────────────────────────── */

function priceColor(median: number | null): string {
  if (median === null) return "#6b7280";     // gray for unknown
  if (median < 300)  return "#22c55e";       // green
  if (median < 600)  return "#f59e0b";       // amber
  if (median < 1000) return "#f97316";       // orange
  return "#ef4444";                          // red
}

function priceColorRGBA(median: number | null, alpha: number): string {
  if (median === null) return `rgba(107,114,128,${alpha})`;
  if (median < 300)  return `rgba(34,197,94,${alpha})`;
  if (median < 600)  return `rgba(245,158,11,${alpha})`;
  if (median < 1000) return `rgba(249,115,22,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}

/* ── Component ───────────────────────────────────────────── */

interface Props {
  data: DistrictIndexRow[];
  /** Height in pixels (default 450) */
  height?: number;
}

export function InteractiveHeatmap({ data, height = 450 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  /* Aggregate rows → per-district summaries */
  const districts = useMemo(() => {
    const map = new Map<string, {
      listings: number;
      prices: number[];
      types: Set<string>;
      city: string;
    }>();

    for (const row of data) {
      const key = row.district || "Unknown";
      const city = row.city ?? "Phnom Penh";
      if (!map.has(key)) {
        map.set(key, { listings: 0, prices: [], types: new Set(), city });
      }
      const entry = map.get(key)!;
      entry.listings += row.listingCount;
      if (row.medianPriceUsd !== null) entry.prices.push(row.medianPriceUsd);
      entry.types.add(row.propertyType);
    }

    const result: DistrictSummary[] = [];
    for (const [district, entry] of map) {
      const median = entry.prices.length > 0
        ? entry.prices.sort((a, b) => a - b)[Math.floor(entry.prices.length / 2)]
        : null;
      
      const coords = DISTRICT_COORDS[district]
        ?? CITY_CENTERS[entry.city]
        ?? CITY_CENTERS["Phnom Penh"];

      result.push({
        district,
        city: entry.city,
        totalListings: entry.listings,
        medianPrice: median,
        types: Array.from(entry.types),
        coords,
      });
    }

    return result;
  }, [data]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    /* Determine initial view from data */
    const hasData = districts.length > 0;
    const center: [number, number] = hasData
      ? [
          districts.reduce((s, d) => s + d.coords[0], 0) / districts.length,
          districts.reduce((s, d) => s + d.coords[1], 0) / districts.length,
        ]
      : [11.5564, 104.9282]; // Phnom Penh default

    const zoom = hasData ? 12 : 13;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    /* Dark-themed tile layer (CartoDB Dark Matter) */
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 18,
      }
    ).addTo(map);

    /* Circle markers for each district */
    for (const d of districts) {
      const radius = Math.max(12, Math.min(40, d.totalListings * 3));
      const color = priceColor(d.medianPrice);
      const fillColor = priceColorRGBA(d.medianPrice, 0.35);

      const circle = L.circleMarker(d.coords, {
        radius,
        color,
        weight: 2,
        fillColor,
        fillOpacity: 0.7,
      }).addTo(map);

      const priceStr = d.medianPrice !== null
        ? `$${Math.round(d.medianPrice).toLocaleString()}/mo`
        : "Price N/A";

      circle.bindPopup(
        `<div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:160px">
          <strong style="font-size:15px;color:#1e293b">${d.district}</strong>
          <br/><span style="color:#64748b">${d.city}</span>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>
          <div><strong style="color:${color}">${priceStr}</strong> median</div>
          <div>${d.totalListings} listing${d.totalListings !== 1 ? "s" : ""}</div>
          <div style="color:#94a3b8;font-size:11px;margin-top:4px">${d.types.join(", ")}</div>
        </div>`,
        { className: "heatmap-popup" }
      );

      /* Permanent district label */
      circle.bindTooltip(d.district, {
        permanent: true,
        direction: "center",
        className: "district-label",
      });
    }

    /* Fit bounds if multiple districts across cities */
    if (districts.length > 1) {
      const allCoords = districts.map((d) => d.coords);
      const latSpread = Math.max(...allCoords.map(c => c[0])) - Math.min(...allCoords.map(c => c[0]));
      // Only fit bounds if there's meaningful geographic spread (>0.1° ≈ 11km)
      if (latSpread > 0.1) {
        map.fitBounds(allCoords.map((c) => [c[0], c[1]] as [number, number]), {
          padding: [40, 40],
          maxZoom: 14,
        });
      }
    }

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, [districts]);

  if (data.length === 0) {
    return (
      <div style={{
        height,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: "10px",
        border: "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
          No index data yet. Run &ldquo;Build Daily Index&rdquo; first.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .district-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #e2e8f0 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6) !important;
          white-space: nowrap !important;
        }
        .district-label::before {
          display: none !important;
        }
        .heatmap-popup .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
      `}</style>
      <div
        ref={mapRef}
        style={{
          height,
          borderRadius: "10px",
          border: "1px solid #334155",
          overflow: "hidden",
        }}
      />
    </>
  );
}
