"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CAMBODIA_GEOJSON_PATH,
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

interface DistrictSummary {
  district: string;
  totalListings: number;
  medianPrice: number | null;
  p25Price: number | null;
  p75Price: number | null;
  types: string[];
}

type MetricMode = "median" | "p25" | "p75" | "volatility";
type Confidence = "high" | "medium" | "low";

interface Props {
  data: DistrictIndexRow[];
  height?: number;
  /** All trend data keyed by "YYYY-MM" for month slider */
  monthlySnapshots?: Record<string, DistrictIndexRow[]>;
}

/* ── Colour helpers ──────────────────────────────────────── */

function priceColor(v: number | null): string {
  if (v === null) return "#0f172a";
  if (v < 300) return "#22c55e";
  if (v < 600) return "#f59e0b";
  if (v < 1000) return "#f97316";
  return "#ef4444";
}

function volatilityColor(listings: number): string {
  if (listings < 5) return "#7c3aed";
  if (listings < 15) return "#6366f1";
  return "#3b82f6";
}

function confidenceLabel(count: number): Confidence {
  if (count < 5) return "low";
  if (count < 15) return "medium";
  return "high";
}

function confidenceBadge(c: Confidence): string {
  switch (c) {
    case "low":
      return '<span style="color:#ef4444;font-size:10px">Low confidence</span>';
    case "medium":
      return '<span style="color:#f59e0b;font-size:10px">Medium confidence</span>';
    case "high":
      return '<span style="color:#22c55e;font-size:10px">High confidence</span>';
  }
}

function polygonCentroid(coords: number[][][]): [number, number] {
  const ring = coords[0];
  const n = ring.length - 1;
  let latSum = 0;
  let lngSum = 0;
  for (let i = 0; i < n; i++) {
    lngSum += ring[i][0];
    latSum += ring[i][1];
  }
  return [latSum / n, lngSum / n];
}

/* ── Component ───────────────────────────────────────────── */

export function HistoricalHeatmap({ data, height = 450, monthlySnapshots }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [metric, setMetric] = useState<MetricMode>("median");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const months = useMemo(
    () => (monthlySnapshots ? Object.keys(monthlySnapshots).sort() : []),
    [monthlySnapshots],
  );

  const activeData = useMemo(() => {
    if (selectedMonth && monthlySnapshots?.[selectedMonth]) {
      return monthlySnapshots[selectedMonth];
    }
    return data;
  }, [data, selectedMonth, monthlySnapshots]);

  useEffect(() => {
    fetch(`${CAMBODIA_GEOJSON_PATH}?v=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setGeoJson)
      .catch(() => setGeoError(true));
  }, []);

  const lookup = useMemo(() => {
    const agg = new Map<
      string,
      { listings: number; medians: number[]; p25s: number[]; p75s: number[]; types: Set<string> }
    >();
    for (const row of activeData) {
      const key = normalizeDistrictName(row.district) ?? "Unknown";
      if (!agg.has(key))
        agg.set(key, { listings: 0, medians: [], p25s: [], p75s: [], types: new Set() });
      const entry = agg.get(key)!;
      entry.listings += row.listingCount;
      if (row.medianPriceUsd !== null) entry.medians.push(row.medianPriceUsd);
      if (row.p25PriceUsd !== null) entry.p25s.push(row.p25PriceUsd);
      if (row.p75PriceUsd !== null) entry.p75s.push(row.p75PriceUsd);
      entry.types.add(row.propertyType);
    }

    const result = new Map<string, DistrictSummary>();
    for (const [district, entry] of agg) {
      const sortM = entry.medians.sort((a, b) => a - b);
      const sortP25 = entry.p25s.sort((a, b) => a - b);
      const sortP75 = entry.p75s.sort((a, b) => a - b);
      result.set(district, {
        district,
        totalListings: entry.listings,
        medianPrice: sortM.length > 0 ? sortM[Math.floor(sortM.length / 2)] : null,
        p25Price: sortP25.length > 0 ? sortP25[Math.floor(sortP25.length / 2)] : null,
        p75Price: sortP75.length > 0 ? sortP75[Math.floor(sortP75.length / 2)] : null,
        types: Array.from(entry.types),
      });
    }
    return result;
  }, [activeData]);

  const getColor = useCallback(
    (info: DistrictSummary | undefined) => {
      if (!info) return "#0f172a";
      switch (metric) {
        case "median":
          return priceColor(info.medianPrice);
        case "p25":
          return priceColor(info.p25Price);
        case "p75":
          return priceColor(info.p75Price);
        case "volatility":
          return volatilityColor(info.totalListings);
      }
    },
    [metric],
  );

  const getMetricValue = useCallback(
    (info: DistrictSummary): number | null => {
      switch (metric) {
        case "median":
          return info.medianPrice;
        case "p25":
          return info.p25Price;
        case "p75":
          return info.p75Price;
        case "volatility":
          return info.totalListings;
      }
    },
    [metric],
  );

  /* Build map once, rebind data on changes */
  useEffect(() => {
    if (!mapRef.current || !geoJson) return;

    if (!leafletMap.current) {
      const map = L.map(mapRef.current, {
        center: [11.562, 104.92],
        zoom: 7,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 18,
      }).addTo(map);
      leafletMap.current = map;
    }

    const map = leafletMap.current;

    // Remove old geo layer
    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    const MIN_LISTINGS = 3;

    function resolveFeatureData(feature: GeoJSON.Feature) {
      const name = feature?.properties?.name as string | undefined;
      const district = feature?.properties?.district as string | undefined;
      const direct = name ? lookup.get(name) : undefined;
      if (direct && direct.totalListings >= MIN_LISTINGS) return { info: direct, isFallback: false };
      if (district) {
        const fallback = lookup.get(district);
        if (fallback && fallback.totalListings >= MIN_LISTINGS)
          return { info: fallback, isFallback: true };
      }
      return { info: undefined, isFallback: false };
    }

    const sharedTooltip = L.tooltip({ sticky: true, direction: "top", className: "choropleth-tooltip" });

    const geoLayer = L.geoJSON(geoJson, {
      style: (feature) => {
        if (!feature) return { fillColor: "#0f172a", fillOpacity: 0.08, color: "#1f2937", weight: 1 };
        const { info, isFallback } = resolveFeatureData(feature);
        if (!info) return { fillColor: "#0f172a", fillOpacity: 0.08, color: "#1f2937", weight: 1 };
        return {
          fillColor: getColor(info),
          fillOpacity: isFallback ? 0.3 : 0.55,
          color: isFallback ? "#334155" : "#1f2937",
          weight: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name as string;
        const district = feature.properties?.district as string | undefined;
        const { info, isFallback } = resolveFeatureData(feature);

        if (info) {
          const metricVal = getMetricValue(info);
          const valStr =
            metric === "volatility"
              ? `${info.totalListings} listings`
              : metricVal !== null
                ? `$${Math.round(metricVal).toLocaleString()}/mo`
                : "\u2014";
          const conf = confidenceLabel(info.totalListings);
          const linkDistrict = isFallback ? (district || name) : name;
          const listingsUrl = `/tools/rentals/listings?district=${encodeURIComponent(linkDistrict)}`;
          const popupHtml =
            `<div style="font-family:system-ui;font-size:13px;line-height:1.6;min-width:180px">` +
            `<strong style="font-size:15px;color:#1e293b">${name}</strong>` +
            (district ? `<div style="color:#94a3b8;font-size:11px">${district}</div>` : "") +
            `<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>` +
            `<div>${metric.toUpperCase()}: <strong style="color:${getColor(info)}">${valStr}</strong></div>` +
            `<div>${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""}</div>` +
            `<div>${confidenceBadge(conf)}</div>` +
            `<div style="color:#94a3b8;font-size:11px;margin-top:4px">${info.types.join(", ")}</div>` +
            `<a href="${listingsUrl}" style="display:inline-block;margin-top:8px;padding:5px 12px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">View listings</a>` +
            `</div>`;
          layer.bindPopup(popupHtml, { className: "choropleth-popup" });
        }

        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
          (layer as L.Path).setStyle({
            weight: 2.5,
            fillOpacity: info ? (isFallback ? 0.45 : 0.75) : 0.15,
            color: "#f8fafc",
          });
          const label = info
            ? `<strong>${name}</strong><br/>${metric}: $${Math.round(getMetricValue(info) ?? 0).toLocaleString()}/mo<br/>${info.totalListings} listings`
            : `<strong>${name}</strong><br/><span style="color:#64748b">No data</span>`;
          sharedTooltip.setContent(label).setLatLng(e.latlng).addTo(map);
        });
        layer.on("mousemove", (e: L.LeafletMouseEvent) => sharedTooltip.setLatLng(e.latlng));
        layer.on("mouseout", () => {
          map.removeLayer(sharedTooltip);
          geoLayer.resetStyle(layer as L.Path);
        });
      },
    }).addTo(map);

    geoLayerRef.current = geoLayer;

    /* Auto-fit */
    const dataFeatures = geoJson.features.filter(
      (f) => resolveFeatureData(f).info,
    );
    if (dataFeatures.length > 0) {
      const dataGeo = L.geoJSON({ type: "FeatureCollection", features: dataFeatures } as GeoJSON.FeatureCollection);
      map.fitBounds(dataGeo.getBounds().pad(0.15));
    }

    return () => {
      if (geoLayerRef.current && leafletMap.current) {
        leafletMap.current.removeLayer(geoLayerRef.current);
        geoLayerRef.current = null;
      }
    };
  }, [lookup, geoJson, metric, getColor, getMetricValue]);

  /* Cleanup on unmount */
  useEffect(
    () => () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    },
    [],
  );

  const emptyBoxStyle: React.CSSProperties = {
    height,
    background: "#0f172a",
    borderRadius: "12px",
    border: "1px solid #1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const emptyText: React.CSSProperties = { color: "#64748b", fontSize: 14 };

  if (activeData.length === 0) return <div style={emptyBoxStyle}><p style={emptyText}>No index data available.</p></div>;
  if (geoError) return <div style={emptyBoxStyle}><p style={emptyText}>Failed to load map boundaries.</p></div>;
  if (!geoJson) return <div style={emptyBoxStyle}><p style={emptyText}>Loading map...</p></div>;

  const toggleGroupStyle: React.CSSProperties = {
    display: "flex",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#0f172a",
    padding: "2px",
  };
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "11px",
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
    background: active ? "#334155" : "transparent",
    color: active ? "#e2e8f0" : "#64748b",
  });
  const legendDot = (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: 2,
    background: color,
    display: "inline-block",
    marginRight: 4,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <div style={toggleGroupStyle}>
          {(["median", "p25", "p75", "volatility"] as MetricMode[]).map((m) => (
            <button key={m} onClick={() => setMetric(m)} style={toggleBtn(metric === m)}>
              {m === "volatility" ? "Volume" : m.toUpperCase()}
            </button>
          ))}
        </div>

        {months.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "11px", color: "#64748b" }}>Month:</label>
            <input
              type="range"
              min={0}
              max={months.length - 1}
              value={selectedMonth ? months.indexOf(selectedMonth) : months.length - 1}
              onChange={(e) => setSelectedMonth(months[parseInt(e.target.value)])}
              style={{ width: 160 }}
            />
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94a3b8" }}>
              {selectedMonth ?? months[months.length - 1]}
            </span>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "#64748b" }}>
          {metric !== "volatility" ? (
            <>
              {[
                { color: "#22c55e", label: "< $300" },
                { color: "#f59e0b", label: "$300-$600" },
                { color: "#f97316", label: "$600-$1k" },
                { color: "#ef4444", label: "> $1k" },
              ].map(({ color, label }) => (
                <span key={label}><span style={legendDot(color)} />{label}</span>
              ))}
            </>
          ) : (
            <>
              {[
                { color: "#7c3aed", label: "< 5 listings" },
                { color: "#6366f1", label: "5-15" },
                { color: "#3b82f6", label: "15+" },
              ].map(({ color, label }) => (
                <span key={label}><span style={legendDot(color)} />{label}</span>
              ))}
            </>
          )}
        </div>
      </div>

      <style>{`
        .choropleth-tooltip {
          background: rgba(15,23,42,0.92) !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
          color: #e2e8f0 !important;
          font-size: 12px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
        }
        .choropleth-tooltip::before { border-top-color: rgba(15,23,42,0.92) !important; }
        .choropleth-popup .leaflet-popup-content-wrapper { border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
      `}</style>
      <div
        ref={mapRef}
        style={{ height, borderRadius: "12px", border: "1px solid #1e293b", overflow: "hidden" }}
      />
    </div>
  );
}
