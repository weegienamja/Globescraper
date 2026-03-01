"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
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

interface ListingPoint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  district: string | null;
  propertyType: string;
  bedrooms: number | null;
  priceMonthlyUsd: number | null;
  source: string;
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

/** Compute centroid of a polygon ring (first ring only). */
function polygonCentroid(coords: number[][][]): [number, number] {
  const ring = coords[0];
  const n = ring.length - 1; // last point == first
  let latSum = 0;
  let lngSum = 0;
  for (let i = 0; i < n; i++) {
    lngSum += ring[i][0];
    latSum += ring[i][1];
  }
  return [latSum / n, lngSum / n];
}

/* ── Component ───────────────────────────────────────────── */

interface Props {
  data: DistrictIndexRow[];
  /** Height in pixels or CSS value (default 450) */
  height?: number | string;
  /** Show the "Show Pins" toggle for individual listing markers (default true). */
  showListingPoints?: boolean;
  /** Base path for "View listings" links in popups (default "/tools/rentals/listings"). */
  listingsLinkBase?: string;
  /** Hide the property-type filter bar entirely (default false). */
  hideFilters?: boolean;
  /** Wrap filters in a collapsible dropdown on mobile (default false). */
  compactFilters?: boolean;
  /** When provided, renders an enlarge button pinned to the top-right of the map. */
  onEnlarge?: () => void;
}

/** Human-readable labels for property type enum values */
const TYPE_LABELS: Record<string, string> = {
  CONDO: "Condo",
  APARTMENT: "Apartment",
  SERVICED_APARTMENT: "Serviced Apt",
  PENTHOUSE: "Penthouse",
  HOUSE: "House",
  VILLA: "Villa",
  TOWNHOUSE: "Townhouse",
};

export function InteractiveHeatmap({ data, height = 450, showListingPoints = true, listingsLinkBase = "/tools/rentals/listings", hideFilters = false, compactFilters = false, onEnlarge }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ── Property type filter state ──────────────────────── */
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const row of data) types.add(row.propertyType);
    // Return in preferred display order
    const order = [
      "CONDO", "APARTMENT", "SERVICED_APARTMENT", "PENTHOUSE",
      "HOUSE", "VILLA", "TOWNHOUSE",
    ];
    return order.filter((t) => types.has(t));
  }, [data]);

  // By default all types are selected
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());

  // Initialise selectedTypes when allTypes is first computed
  useEffect(() => {
    if (allTypes.length > 0 && selectedTypes.size === 0) {
      setSelectedTypes(new Set(allTypes));
    }
  }, [allTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow deselecting ALL — keep at least one
        if (next.size <= 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const selectAllTypes = () => setSelectedTypes(new Set(allTypes));

  /* ── Listing point markers (exact coordinates) ──────── */
  const [showPoints, setShowPoints] = useState(false);
  const [listingPoints, setListingPoints] = useState<ListingPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsFetched, setPointsFetched] = useState(false);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Fetch listing points on first toggle
  useEffect(() => {
    if (!showPoints || pointsFetched) return;
    setPointsLoading(true);
    fetch("/api/tools/rentals/listing-points")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((pts: ListingPoint[]) => {
        setListingPoints(pts);
        setPointsFetched(true);
      })
      .catch(() => { /* silently fail — points are optional */ })
      .finally(() => setPointsLoading(false));
  }, [showPoints, pointsFetched]);

  // Filter points by selected property types
  const filteredPoints = useMemo(
    () => listingPoints.filter((p) => selectedTypes.has(p.propertyType)),
    [listingPoints, selectedTypes],
  );

  // Sync marker layer with map
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    // Remove existing markers
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    if (!showPoints || filteredPoints.length === 0) return;

    const markerGroup = L.layerGroup();

    for (const pt of filteredPoints) {
      const priceLabel = pt.priceMonthlyUsd
        ? `$${pt.priceMonthlyUsd.toLocaleString()}/mo`
        : "N/A";
      const color = pt.priceMonthlyUsd === null ? "#64748b"
        : pt.priceMonthlyUsd < 300 ? "#22c55e"
        : pt.priceMonthlyUsd < 600 ? "#f59e0b"
        : pt.priceMonthlyUsd < 1000 ? "#f97316"
        : "#ef4444";

      const marker = L.circleMarker([pt.latitude, pt.longitude], {
        radius: 5,
        fillColor: color,
        fillOpacity: 0.85,
        color: "#0f172a",
        weight: 1,
      });

      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.5">
          <strong>${pt.title.slice(0, 80)}</strong><br/>
          <span style="color:${color};font-weight:600">${priceLabel}</span>
          ${pt.bedrooms ? ` · ${pt.bedrooms} bed` : ""}
          ${pt.district ? ` · ${pt.district}` : ""}<br/>
          <span style="color:#94a3b8;font-size:11px">${pt.source.replace(/_/g, " ")}</span>
        </div>`,
        { maxWidth: 280 },
      );
      marker.addTo(markerGroup);
    }

    markerGroup.addTo(map);
    markersLayerRef.current = markerGroup;

    return () => {
      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current);
        markersLayerRef.current = null;
      }
    };
  }, [showPoints, filteredPoints]);

  /* Filtered data based on selected property types */
  const filteredData = useMemo(
    () => (selectedTypes.size === 0 ? data : data.filter((r) => selectedTypes.has(r.propertyType))),
    [data, selectedTypes]
  );

  /* Fetch GeoJSON on mount */
  useEffect(() => {
    // Cache-bust to ensure latest GeoJSON after deploys
    const url = `${CAMBODIA_GEOJSON_PATH}?v=${Date.now()}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setGeoJson)
      .catch(() => setGeoError(true));
  }, []);

  /* Aggregate rows → lookup by normalised district name */
  const lookup = useMemo(() => {
    const agg = new Map<
      string,
      { listings: number; prices: number[]; types: Set<string> }
    >();

    for (const row of filteredData) {
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
  }, [filteredData]);

  /* Build map once GeoJSON is loaded */
  useEffect(() => {
    if (!mapRef.current || leafletMap.current || !geoJson) return;

    /* Default centre on Phnom Penh; will auto-fit below */
    const map = L.map(mapRef.current, {
      center: [11.562, 104.920],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    /* Minimal custom attribution */
    L.control.attribution({
      position: "bottomright",
      prefix: false,
    }).addTo(map);

    /* Dark-themed tile layer (CartoDB Dark Matter) */
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '© OSM © CARTO',
        maxZoom: 18,
      },
    ).addTo(map);

    /* ── Choropleth GeoJSON layer ──────────────────────── */

    const MIN_LISTINGS = 1;

    /**
     * Resolve feature data: try exact sangkat name first,
     * then fall back to parent district (khan) for PP sangkats.
     */
    function resolveFeatureData(feature: any): {
      info: DistrictSummary | undefined;
      isFallback: boolean;
    } {
      const name = feature?.properties?.name as string | undefined;
      const district = feature?.properties?.district as string | undefined;

      // 1. Exact sangkat / feature name match
      const direct = name ? lookup.get(name) : undefined;
      if (direct && direct.totalListings >= MIN_LISTINGS) {
        return { info: direct, isFallback: false };
      }

      // 2. Fall back to parent district (PP sangkats carry a district prop)
      if (district) {
        const fallback = lookup.get(district);
        if (fallback && fallback.totalListings >= MIN_LISTINGS) {
          return { info: fallback, isFallback: true };
        }
      }

      return { info: undefined, isFallback: false };
    }

    /* ── Single shared tooltip (avoids stuck-tooltip bug) ── */
    const sharedTooltip = L.tooltip({
      sticky: true,
      direction: "top",
      className: "choropleth-tooltip",
    });

    const geoLayer = L.geoJSON(geoJson, {
      style: (feature) => {
        const { info, isFallback } = resolveFeatureData(feature);

        if (!info) {
          return {
            fillColor: "#0f172a",
            fillOpacity: 0.08,
            color: "#1f2937",
            weight: 1,
          };
        }

        return {
          fillColor: priceColor(info.medianPrice),
          fillOpacity: isFallback ? 0.3 : 0.55,
          color: isFallback ? "#334155" : "#1f2937",
          weight: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name as string;
        const district = feature.properties?.district as string | undefined;
        const { info, isFallback } = resolveFeatureData(feature);
        const hasData = !!info;

        /* ── Click popup ──────────────────────────────── */
        if (hasData) {
          const priceStr =
            info.medianPrice !== null
              ? `$${Math.round(info.medianPrice).toLocaleString()}/mo`
              : "—";

          let popupHtml: string;

          // Build the link to filtered listings page
          const linkDistrict = isFallback ? (district || name) : name;
          const listingsUrl = `${listingsLinkBase}?district=${encodeURIComponent(linkDistrict)}`;
          const viewLink =
            `<a href="${listingsUrl}" style="display:inline-block;margin-top:8px;padding:5px 12px;` +
            `background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;" ` +
            `onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">` +
            `View ${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""} \u2192</a>`;

          if (isFallback) {
            // Fallback: show district-level summary without repeating exact numbers
            popupHtml =
              `<div style="font-family:sans-serif;font-size:13px;line-height:1.6;min-width:170px">` +
              `<strong style="font-size:15px;color:#1e293b">${name}</strong>` +
              (district ? `<div style="color:#94a3b8;font-size:11px">${district} district</div>` : "") +
              `<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>` +
              `<div style="color:#64748b;font-size:12px;font-style:italic;margin-bottom:4px">No sangkat-specific data</div>` +
              `<div>District median: <strong style="color:${priceColor(info.medianPrice)}">${priceStr}</strong></div>` +
              `<div>Band: ${priceBand(info.medianPrice)}</div>` +
              `<div style="color:#94a3b8;font-size:11px;margin-top:4px">${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""} across ${district}</div>` +
              `<div style="color:#94a3b8;font-size:11px">${info.types.join(", ")}</div>` +
              viewLink +
              `</div>`;
          } else {
            popupHtml =
              `<div style="font-family:sans-serif;font-size:13px;line-height:1.6;min-width:170px">` +
              `<strong style="font-size:15px;color:#1e293b">${name}</strong>` +
              (district ? `<div style="color:#94a3b8;font-size:11px">${district}</div>` : "") +
              `<hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>` +
              `<div>Median: <strong style="color:${priceColor(info.medianPrice)}">${priceStr}</strong></div>` +
              `<div>Band: ${priceBand(info.medianPrice)}</div>` +
              `<div>${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""}</div>` +
              `<div style="color:#94a3b8;font-size:11px;margin-top:4px">${info.types.join(", ")}</div>` +
              viewLink +
              `</div>`;
          }

          layer.bindPopup(popupHtml, { className: "choropleth-popup" });
        }

        /* ── Hover: individual highlight + tooltip ──── */
        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
          (layer as L.Path).setStyle({
            weight: 2.5,
            fillOpacity: hasData ? (isFallback ? 0.45 : 0.75) : 0.15,
            color: "#f8fafc",
          });

          const tooltipHtml = hasData
            ? isFallback
              ? `<strong>${name}</strong>` +
                (district ? `<br/><span style="color:#94a3b8;font-size:11px">${district} district</span>` : "") +
                `<br/>District median: <b style="color:${priceColor(info.medianPrice)}">` +
                `$${Math.round(info.medianPrice ?? 0).toLocaleString()}/mo</b>` +
                `<br/><span style="color:#94a3b8;font-size:10px">No sangkat data — showing district</span>`
              : `<strong>${name}</strong>` +
                (district ? `<br/><span style="color:#94a3b8;font-size:11px">${district}</span>` : "") +
                `<br/>Median: <b style="color:${priceColor(info.medianPrice)}">` +
                `$${Math.round(info.medianPrice ?? 0).toLocaleString()}/mo</b>` +
                `<br/>${info.totalListings} listing${info.totalListings !== 1 ? "s" : ""}`
            : `<strong>${name}</strong>` +
              (district ? `<br/><span style="color:#94a3b8;font-size:11px">${district}</span>` : "") +
              `<br/><span style="color:#64748b">No data</span>`;

          sharedTooltip
            .setContent(tooltipHtml)
            .setLatLng(e.latlng)
            .addTo(map);
        });

        layer.on("mousemove", (e: L.LeafletMouseEvent) => {
          sharedTooltip.setLatLng(e.latlng);
        });

        layer.on("mouseout", () => {
          map.removeLayer(sharedTooltip);
          geoLayer.resetStyle(layer as L.Path);
        });
      },
    }).addTo(map);

    /* ── Labels: one per district for PP sangkats, one per name for others ── */
    const labelCentroids = new Map<
      string,
      { latSum: number; lngSum: number; count: number }
    >();
    geoJson.features.forEach((feature: any) => {
      const name = feature.properties?.name as string;
      const district = feature.properties?.district as string | undefined;
      const { info } = resolveFeatureData(feature);
      if (!info) return;

      // For PP/SR sangkats use parent district as label key (avoids clutter)
      const labelKey = district || name;

      const geom = feature.geometry;
      const coords =
        geom.type === "MultiPolygon"
          ? geom.coordinates[0]
          : geom.coordinates;
      const [lat, lng] = polygonCentroid(coords);

      const existing = labelCentroids.get(labelKey);
      if (existing) {
        existing.latSum += lat;
        existing.lngSum += lng;
        existing.count += 1;
      } else {
        labelCentroids.set(labelKey, { latSum: lat, lngSum: lng, count: 1 });
      }
    });

    labelCentroids.forEach(({ latSum, lngSum, count }, name) => {
      L.marker([latSum / count, lngSum / count], {
        icon: L.divIcon({
          className: "district-label",
          html: `<span>${name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
      }).addTo(map);
    });

    /* ── Auto-fit to features that have data ──────────── */
    const dataFeatures = geoJson.features.filter(
      (f: any) => resolveFeatureData(f).info,
    );
    if (dataFeatures.length > 0) {
      const dataGeo = L.geoJSON({
        type: "FeatureCollection",
        features: dataFeatures,
      } as GeoJSON.FeatureCollection);
      map.fitBounds(dataGeo.getBounds().pad(0.15));
    }

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup, geoJson]);

  const emptyPlaceholder = (msg: string) => (
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
      <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>{msg}</p>
    </div>
  );

  if (data.length === 0) {
    return emptyPlaceholder(
      "No index data yet. Run \u201CBuild Daily Index\u201D first.",
    );
  }
  if (geoError) {
    return emptyPlaceholder("Failed to load map boundaries.");
  }
  if (!geoJson) {
    return emptyPlaceholder("Loading map\u2026");
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
      {/* Property type checkbox filter bar */}
      {!hideFilters && allTypes.length > 1 && (
        <>
          {/* Compact mode: mobile dropdown toggle */}
          {compactFilters && (
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="heatmap-filter-toggle"
              style={{
                display: "none", /* shown via CSS media query */
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#94a3b8",
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
              Filters
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transition: "transform 0.2s", transform: filtersOpen ? "rotate(180deg)" : "rotate(0)" }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
          <div
            className={compactFilters ? "heatmap-filter-bar heatmap-filter-bar--compact" + (filtersOpen ? " heatmap-filter-bar--open" : "") : "heatmap-filter-bar"}
            style={{ marginBottom: "10px" }}
          >
          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
            Filter:
          </span>
          <div className="heatmap-filter-grid">
            {allTypes.map((type) => {
              const active = selectedTypes.has(type);
              return (
                <label
                  key={type}
                  className="heatmap-filter-pill"
                  style={{
                    border: active ? "1px solid #3b82f6" : "1px solid #334155",
                    background: active ? "#1e3a5f" : "#0f172a",
                    color: active ? "#93c5fd" : "#64748b",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleType(type)}
                    style={{
                      accentColor: "#3b82f6",
                      width: "14px",
                      height: "14px",
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {TYPE_LABELS[type] || type}
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
            {selectedTypes.size < allTypes.length && (
              <button
                onClick={selectAllTypes}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                Select All
              </button>
            )}
            {showListingPoints && (
              <>
                {selectedTypes.size < allTypes.length && (
                  <span style={{ color: "#1e293b", fontSize: "12px", margin: "0 2px" }}>|</span>
                )}
                <button
                  onClick={() => setShowPoints((v) => !v)}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    border: showPoints ? "1px solid #10b981" : "1px solid #334155",
                    background: showPoints ? "#064e3b" : "#0f172a",
                    color: showPoints ? "#6ee7b7" : "#64748b",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {pointsLoading ? "Loading\u2026" : showPoints
                    ? `Pins ON (${filteredPoints.length})`
                    : "Show Pins"}
                </button>
              </>
            )}
          </div>
        </div>
        </>
      )}
      <div style={{ position: "relative" }}>
        <div
          ref={mapRef}
          style={{
            height,
            borderRadius: "10px",
            border: "1px solid #334155",
            overflow: "hidden",
          }}
        />
        {onEnlarge && (
          <button
            onClick={onEnlarge}
            aria-label="View fullscreen"
            title="Enlarge map"
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#cbd5e1",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
