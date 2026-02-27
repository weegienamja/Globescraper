"use client";

import React, { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  PHNOM_PENH_GEOJSON,
  normalizeDistrictName,
} from "@/lib/rentals/district-geo";

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

/** Per-district aggregated data for colouring the choropleth. */
interface DistrictSummary {
  district: string;
  totalListings: number;
  medianPrice: number | null;
  types: string[];
}

/* ── Colour helpers ──────────────────────────────────────── */

function priceColor(median: number | null): string {
  if (median === null) return "#0f172a"; // dark — no data
  if (median < 300) return "#22c55e"; // green
  if (median < 600) return "#f59e0b"; // amber
  if (median < 1000) return "#f97316"; // orange
  return "#ef4444"; // red
}

function priceBand(median: number | null): string {
  if (median === null) return "N/A";
  if (median < 300) return "< $300/mo";
  if (median < 600) return "$300 – $600/mo";
  if (median < 1000) return "$600 – $1,000/mo";
  return "> $1,000/mo";
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

  /* Aggregate rows → lookup by normalised district name */
  const lookup = useMemo(() => {
    const agg = new Map<
      string,
      { listings: number; prices: number[]; types: Set<string> }
    >();

    for (const row of data) {
      const key = normalizeDistrictName(row.district) ?? "Unknown";
      if (!agg.has(key)) {
        agg.set(key, { listings: 0, prices: [], types: new Set() });
      }
      const entry = agg.get(key)!;
      entry.listings += row.listingCount;
      if (row.medianPriceUsd !== null) entry.prices.push(row.medianPriceUsd);
      entry.types.add(row.propertyType);
    }

    const result = new Map<string, DistrictSummary>();
    for (const [district, entry] of agg) {
      const sorted = entry.prices.sort((a, b) => a - b);
      const median =
        sorted.length > 0
          ? sorted[Math.floor(sorted.length / 2)]
          : null;
      result.set(district, {
        district,
        totalListings: entry.listings,
        medianPrice: median,
        types: Array.from(entry.types),
      });
    }
    return result;
  }, [data]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    /* Centre on Phnom Penh */
    const map = L.map(mapRef.current, {
      center: [11.562, 104.920],
      zoom: 12,
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
      },
    ).addTo(map);

    /* ── Choropleth GeoJSON layer ──────────────────────── */

    const MIN_LISTINGS = 3;

    const geoLayer = L.geoJSON(
      PHNOM_PENH_GEOJSON as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const name = feature?.properties?.name as string | undefined;
          const info = name ? lookup.get(name) : undefined;
          const hasData = info && info.totalListings >= MIN_LISTINGS;

          return {
            fillColor: hasData ? priceColor(info.medianPrice) : "#0f172a",
            fillOpacity: hasData ? 0.55 : 0.15,
            color: "#1f2937",
            weight: 1,
          };
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name as string;
          const info = lookup.get(name);
          const hasData = info && info.totalListings >= MIN_LISTINGS;

          /* ── Tooltip (hover) ──────────────────────────── */
          const tooltipHtml = hasData
            ? `<strong>${name}</strong><br/>` +
              `Median: <b style="color:${priceColor(info.medianPrice)}">` +
              `$${Math.round(info.medianPrice ?? 0).toLocaleString()}/mo</b><br/>` +
              `${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""}`
            : `<strong>${name}</strong><br/><span style="color:#64748b">Insufficient data</span>`;

          layer.bindTooltip(tooltipHtml, {
            sticky: true,
            direction: "top",
            className: "choropleth-tooltip",
          });

          /* ── Click popup ──────────────────────────────── */
          const priceStr =
            hasData && info.medianPrice !== null
              ? `$${Math.round(info.medianPrice).toLocaleString()}/mo`
              : "—";

          const popupHtml =
            `<div style="font-family:sans-serif;font-size:13px;line-height:1.6;min-width:170px">` +
            `<strong style="font-size:15px;color:#1e293b">${name}</strong>` +
            `<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>` +
            (hasData
              ? `<div>Median: <strong style="color:${priceColor(info.medianPrice)}">${priceStr}</strong></div>` +
                `<div>Band: ${priceBand(info.medianPrice)}</div>` +
                `<div>${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""}</div>` +
                `<div style="color:#94a3b8;font-size:11px;margin-top:4px">${info.types.join(", ")}</div>`
              : `<div style="color:#94a3b8">Insufficient data</div>`) +
            `</div>`;

          layer.bindPopup(popupHtml, { className: "choropleth-popup" });

          /* ── Hover highlight ──────────────────────────── */
          layer.on("mouseover", () => {
            (layer as L.Path).setStyle({
              weight: 2.5,
              fillOpacity: hasData ? 0.75 : 0.25,
              color: "#f8fafc",
            });
            (layer as L.Path).bringToFront();
          });
          layer.on("mouseout", () => {
            geoLayer.resetStyle(layer as L.Path);
          });
        },
      },
    ).addTo(map);

    /* ── District name labels ──────────────────────────── */
    PHNOM_PENH_GEOJSON.features.forEach((feature) => {
      const name = feature.properties?.name as string;
      const coords = feature.geometry.coordinates[0];
      // Compute centroid from polygon vertices
      let latSum = 0;
      let lngSum = 0;
      const n = coords.length - 1; // last point == first
      for (let i = 0; i < n; i++) {
        lngSum += coords[i][0];
        latSum += coords[i][1];
      }
      const centroid: [number, number] = [latSum / n, lngSum / n];

      L.marker(centroid, {
        icon: L.divIcon({
          className: "district-label",
          html: `<span>${name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
      }).addTo(map);
    });

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup]);

  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: "10px",
          border: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#475569"
          strokeWidth="1.5"
        >
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
          pointer-events: none !important;
        }
        .district-label span {
          color: #e2e8f0;
          font-size: 10px;
          font-weight: 600;
          text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);
          white-space: nowrap;
          position: relative;
          left: -50%;
        }
        .choropleth-tooltip {
          background: rgba(15,23,42,0.92) !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
          color: #e2e8f0 !important;
          font-size: 12px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
        }
        .choropleth-tooltip::before {
          border-top-color: rgba(15,23,42,0.92) !important;
        }
        .choropleth-popup .leaflet-popup-content-wrapper {
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
