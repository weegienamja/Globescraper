"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ───────────────────────────────────────────────── */

interface Listing {
  id: string;
  source: string;
  title: string;
  canonicalUrl: string;
  city: string;
  district: string | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  priceMonthlyUsd: number | null;
  priceOriginal: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  postedAt: string | null;
  isActive: boolean;
  imageUrlsJson: string | null;
  amenitiesJson: string | null;
  _count: { snapshots: number };
  snapshots: Snapshot[];
  priceChange: {
    hasPriceChange: boolean;
    latestPrice: number | null;
    previousPrice: number | null;
    priceDirection: "up" | "down" | "same" | null;
    uniquePriceCount: number;
  };
  aiReview: AiReview | null;
}

interface Snapshot {
  id: string;
  scrapedAt: string;
  priceMonthlyUsd: number | null;
  priceOriginal: string | null;
}

interface AiReview {
  id: string;
  reviewedAt: string;
  suggestedType: string | null;
  isResidential: boolean;
  confidence: number;
  reason: string | null;
  flagged: boolean;
}

interface ListingsData {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── Component ───────────────────────────────────────────── */

interface ListingsTableProps {
  /** Pre-filter to a specific district (canonical name from heatmap). */
  initialDistrict?: string;
}

export function ListingsTable({ initialDistrict }: ListingsTableProps = {}) {
  const [data, setData] = useState<ListingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [district, setDistrict] = useState(initialDistrict || "");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("lastSeenAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      params.set("sort", sort);
      params.set("order", order);
      if (source) params.set("source", source);
      if (propertyType) params.set("propertyType", propertyType);
      if (district) params.set("district", district);
      if (search) params.set("search", search);

      const res = await fetch(`/api/tools/rentals/listings?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, source, propertyType, district, search, sort, order]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(field);
      setOrder("desc");
    }
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const sourceLabel = (s: string) => {
    const map: Record<string, string> = {
      KHMER24: "Khmer24",
      REALESTATE_KH: "Realestate.kh",
      IPS_CAMBODIA: "IPS Cambodia",
      CAMREALTY: "CamRealty",
      LONGTERMLETTINGS: "LongTermLettings",
      FAZWAZ: "FazWaz",
      HOMETOGO: "HomeToGo",
    };
    return map[s] || s;
  };

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      APARTMENT: "Apartment",
      CONDO: "Condo",
      HOUSE: "House",
      VILLA: "Long Term Rental",
      TOWNHOUSE: "Long Term Rental",
      SERVICED_APARTMENT: "Serviced Apt",
      PENTHOUSE: "Penthouse",
      SHOPHOUSE: "Shophouse",
      LAND: "Land",
      COMMERCIAL: "Commercial",
      WAREHOUSE: "Warehouse",
      OFFICE: "Office",
      OTHER: "Other",
    };
    return map[t] || t;
  };

  const sourceBadgeColor = (src: string): { bg: string; fg: string } => {
    const colors: Record<string, { bg: string; fg: string }> = {
      REALESTATE_KH: { bg: "rgba(244, 114, 182, 0.15)", fg: "#f472b6" },
      KHMER24:       { bg: "rgba(99, 102, 241, 0.15)",  fg: "#818cf8" },
      IPS_CAMBODIA:  { bg: "rgba(52, 211, 153, 0.15)",  fg: "#34d399" },
      CAMREALTY:     { bg: "rgba(251, 191, 36, 0.15)",  fg: "#fbbf24" },
      FAZWAZ:        { bg: "rgba(96, 165, 250, 0.15)",  fg: "#60a5fa" },
      LONGTERMLETTINGS: { bg: "rgba(167, 139, 250, 0.15)", fg: "#a78bfa" },
      HOMETOGO:      { bg: "rgba(248, 113, 113, 0.15)", fg: "#f87171" },
    };
    return colors[src] || { bg: "rgba(148, 163, 184, 0.1)", fg: "#94a3b8" };
  };

  const sortIcon = (field: string) => {
    if (sort !== field) return " ↕";
    return order === "desc" ? " ↓" : " ↑";
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFirstImage = (json: string | null): string | null => {
    if (!json) return null;
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    } catch {
      return null;
    }
  };

  return (
    <div style={s.wrapper}>
      <div style={s.header}>
        <h2 style={s.title}>Scraped Listings</h2>
        {data && (
          <span style={s.count}>{data.total.toLocaleString()} total</span>
        )}
      </div>

      {/* Filters Row */}
      <div style={s.filters}>
        <select
          style={s.select}
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1); }}
        >
          <option value="">All Sources</option>
          <option value="REALESTATE_KH">Realestate.kh</option>
          <option value="KHMER24">Khmer24</option>
          <option value="IPS_CAMBODIA">IPS Cambodia</option>
          <option value="CAMREALTY">CamRealty</option>
          <option value="FAZWAZ">FazWaz</option>
          <option value="LONGTERMLETTINGS">LongTermLettings</option>
        </select>
        <select
          style={s.select}
          value={propertyType}
          onChange={(e) => { setPropertyType(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          <option value="APARTMENT">Apartment</option>
          <option value="CONDO">Condo</option>
          <option value="HOUSE">House</option>
          <option value="SERVICED_APARTMENT">Serviced Apartment</option>
          <option value="PENTHOUSE">Penthouse</option>
          <option value="LONG_TERM_RENTAL">Long Term Rental</option>
        </select>
        {district && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "8px",
            color: "#a5b4fc",
            fontSize: "13px",
            fontWeight: 500,
          }}>
            <span>📍 {district}</span>
            <button
              onClick={() => { setDistrict(""); setPage(1); }}
              style={{
                background: "none",
                border: "none",
                color: "#a5b4fc",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                padding: "0 2px",
              }}
              title="Clear district filter"
            >
              ×
            </button>
          </div>
        )}
        <div style={s.searchWrap}>
          <input
            style={s.searchInput}
            type="text"
            placeholder="Search title, district..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button style={s.searchBtn} onClick={handleSearch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.loadingMsg}>Loading listings...</div>
        ) : !data || data.listings.length === 0 ? (
          <div style={s.emptyMsg}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🏠</div>
            No listings found. Run the pipeline to scrape some data.
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}></th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("title")}
                >
                  Listing{sortIcon("title")}
                </th>
                <th style={s.th}>Source</th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("district")}
                >
                  Location{sortIcon("district")}
                </th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Beds</th>
                <th style={s.th}>Baths</th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("sizeSqm")}
                >
                  Size{sortIcon("sizeSqm")}
                </th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("priceMonthlyUsd")}
                >
                  Price/mo{sortIcon("priceMonthlyUsd")}
                </th>
                <th style={s.th}>$/m²</th>
                <th style={s.th}>History</th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("postedAt")}
                >
                  Posted{sortIcon("postedAt")}
                </th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("lastSeenAt")}
                >
                  Last Seen{sortIcon("lastSeenAt")}
                </th>
                <th style={s.th}>AI</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.listings.map((l) => {
                const img = getFirstImage(l.imageUrlsJson);
                const expanded = expandedId === l.id;
                return (
                  <tr
                    key={l.id}
                    style={{
                      ...s.tr,
                      background: expanded ? "rgba(30, 41, 59, 0.8)" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedId(expanded ? null : l.id)}
                  >
                    <td style={s.td}>
                      <div style={s.thumb}>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            style={s.thumbImg}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div style={s.thumbPlaceholder}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={s.titleCell}>
                        <a
                          href={l.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={s.titleLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {l.title.length > 60
                            ? l.title.substring(0, 60) + "..."
                            : l.title}
                        </a>
                        {expanded && (
                          <div style={s.expandedInfo}>
                            <div style={s.expandRow}>
                              <span style={s.expandLabel}>Full Title:</span>
                              <span style={s.expandValue}>{l.title}</span>
                            </div>
                            {l.sizeSqm && (
                              <div style={s.expandRow}>
                                <span style={s.expandLabel}>Size:</span>
                                <span style={s.expandValue}>{l.sizeSqm} sqm</span>
                              </div>
                            )}
                            {l.bathrooms && (
                              <div style={s.expandRow}>
                                <span style={s.expandLabel}>Bathrooms:</span>
                                <span style={s.expandValue}>{l.bathrooms}</span>
                              </div>
                            )}
                            {l.priceOriginal && (
                              <div style={s.expandRow}>
                                <span style={s.expandLabel}>Original Price:</span>
                                <span style={s.expandValue}>{l.priceOriginal}</span>
                              </div>
                            )}
                            <div style={s.expandRow}>
                              <span style={s.expandLabel}>First Seen:</span>
                              <span style={s.expandValue}>{formatDate(l.firstSeenAt)}</span>
                            </div>
                            {l.amenitiesJson && (() => {
                              try {
                                const amenities: string[] = JSON.parse(l.amenitiesJson);
                                if (amenities.length === 0) return null;
                                return (
                                  <div style={s.expandRow}>
                                    <span style={s.expandLabel}>Amenities:</span>
                                    <span style={s.expandValue}>
                                      <span style={{ display: "flex", flexWrap: "wrap" as const, gap: "4px" }}>
                                        {amenities.map((a) => (
                                          <span
                                            key={a}
                                            style={{
                                              display: "inline-block",
                                              padding: "2px 7px",
                                              borderRadius: "4px",
                                              background: "rgba(99, 102, 241, 0.12)",
                                              color: "#a5b4fc",
                                              fontSize: "11px",
                                              whiteSpace: "nowrap" as const,
                                            }}
                                          >
                                            {a}
                                          </span>
                                        ))}
                                      </span>
                                    </span>
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                            {/* ── Price History Timeline ── */}
                            {l.snapshots && l.snapshots.length > 0 && (
                              <div style={{ marginTop: "8px" }}>
                                <div style={s.expandRow}>
                                  <span style={s.expandLabel}>Price History:</span>
                                  <span style={{ ...s.expandValue, color: "#64748b" }}>
                                    {l._count.snapshots} snapshot{l._count.snapshots !== 1 ? "s" : ""}
                                    {l.priceChange.hasPriceChange && (
                                      <span style={{
                                        marginLeft: "8px",
                                        color: l.priceChange.priceDirection === "down" ? "#34d399" : "#f87171",
                                        fontWeight: 600,
                                      }}>
                                        {l.priceChange.uniquePriceCount} different price{l.priceChange.uniquePriceCount !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div style={s.snapshotTimeline}>
                                  {l.snapshots.map((snap, idx) => {
                                    const prev = l.snapshots[idx + 1];
                                    const changed = prev && snap.priceMonthlyUsd !== prev.priceMonthlyUsd;
                                    const dir = changed && snap.priceMonthlyUsd !== null && prev.priceMonthlyUsd !== null
                                      ? snap.priceMonthlyUsd > prev.priceMonthlyUsd ? "up" : "down"
                                      : null;
                                    return (
                                      <div key={snap.id} style={s.snapRow}>
                                        <span style={s.snapDate}>
                                          {new Date(snap.scrapedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                        <span style={{
                                          ...s.snapPrice,
                                          color: changed
                                            ? dir === "down" ? "#34d399" : "#f87171"
                                            : "#e2e8f0",
                                          fontWeight: changed ? 600 : 400,
                                        }}>
                                          {snap.priceMonthlyUsd !== null
                                            ? `$${snap.priceMonthlyUsd.toLocaleString()}/mo`
                                            : "—"}
                                          {dir === "up" && " ↑"}
                                          {dir === "down" && " ↓"}
                                        </span>
                                        {snap.priceOriginal && (
                                          <span style={s.snapOriginal}>({snap.priceOriginal})</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {l._count.snapshots > l.snapshots.length && (
                                    <div style={{ ...s.snapRow, color: "#475569", fontStyle: "italic" }}>
                                      +{l._count.snapshots - l.snapshots.length} older snapshots
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* ── AI Review Details ── */}
                            {l.aiReview && (
                              <div style={s.expandRow}>
                                <span style={s.expandLabel}>AI Review:</span>
                                <span style={s.expandValue}>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    marginRight: "8px",
                                    background: l.aiReview.flagged
                                      ? "rgba(251, 191, 36, 0.15)"
                                      : "rgba(34, 197, 94, 0.1)",
                                    color: l.aiReview.flagged ? "#fbbf24" : "#4ade80",
                                  }}>
                                    {l.aiReview.flagged ? "⚠ Flagged" : "✓ OK"} — {(l.aiReview.confidence * 100).toFixed(0)}% confidence
                                  </span>
                                  {!l.aiReview.isResidential && (
                                    <span style={{
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      fontSize: "12px",
                                      background: "rgba(239, 68, 68, 0.15)",
                                      color: "#f87171",
                                      marginRight: "8px",
                                    }}>
                                      Non-residential
                                    </span>
                                  )}
                                  {l.aiReview.suggestedType && l.aiReview.suggestedType !== l.propertyType && (
                                    <span style={{
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      fontSize: "12px",
                                      background: "rgba(99, 102, 241, 0.15)",
                                      color: "#a5b4fc",
                                    }}>
                                      Suggests: {l.aiReview.suggestedType}
                                    </span>
                                  )}
                                  {l.aiReview.reason && (
                                    <div style={{ marginTop: "4px", color: "#94a3b8", fontSize: "12px" }}>
                                      {l.aiReview.reason}
                                    </div>
                                  )}
                                </span>
                              </div>
                            )}
                            <div style={s.expandRow}>
                              <span style={s.expandLabel}>URL:</span>
                              <a
                                href={l.canonicalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ ...s.expandValue, color: "#60a5fa", wordBreak: "break-all" as const }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {l.canonicalUrl}
                              </a>
                            </div>
                            {/* ── Admin actions ── */}
                            <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: "6px",
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                  background: "rgba(239, 68, 68, 0.1)",
                                  color: "#f87171",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Remove "${l.title.slice(0, 60)}" from listings?`)) return;
                                  try {
                                    const res = await fetch(`/api/tools/rentals/listings/${l.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "deactivate" }),
                                    });
                                    if (res.ok) {
                                      fetchListings();
                                      setExpandedId(null);
                                    } else {
                                      alert("Failed to deactivate listing");
                                    }
                                  } catch { alert("Network error"); }
                                }}
                              >
                                🚫 Remove Listing
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{
                        ...s.badge,
                        background: sourceBadgeColor(l.source).bg,
                        color: sourceBadgeColor(l.source).fg,
                      }}>
                        {sourceLabel(l.source)}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ color: "#e2e8f0", fontSize: "13px" }}>{l.district || "—"}</div>
                      <div style={{ color: "#64748b", fontSize: "12px" }}>{l.city}</div>
                    </td>
                    <td style={s.td}>
                      <span style={s.typeBadge}>{typeLabel(l.propertyType)}</span>
                    </td>
                    <td style={{ ...s.td, color: "#e2e8f0" }}>
                      {l.bedrooms !== null ? l.bedrooms : "—"}
                    </td>
                    <td style={{ ...s.td, color: "#e2e8f0" }}>
                      {l.bathrooms !== null ? l.bathrooms : "—"}
                    </td>
                    <td style={{ ...s.td, color: "#94a3b8", fontSize: "13px", whiteSpace: "nowrap" }}>
                      {l.sizeSqm ? `${l.sizeSqm} m²` : "—"}
                    </td>
                    <td style={s.td}>
                      <span style={{
                        color: l.priceMonthlyUsd ? "#34d399" : "#64748b",
                        fontWeight: l.priceMonthlyUsd ? 600 : 400,
                        fontSize: "14px",
                      }}>
                        {l.priceMonthlyUsd
                          ? `$${l.priceMonthlyUsd.toLocaleString()}`
                          : "—"}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: "#94a3b8", fontSize: "13px", whiteSpace: "nowrap" }}>
                      {l.priceMonthlyUsd && l.sizeSqm
                        ? `$${(l.priceMonthlyUsd / l.sizeSqm).toFixed(1)}`
                        : "—"}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          ...s.badge,
                          background: l.priceChange.hasPriceChange
                            ? l.priceChange.priceDirection === "down"
                              ? "rgba(34, 197, 94, 0.15)"
                              : "rgba(248, 113, 113, 0.15)"
                            : "rgba(148, 163, 184, 0.08)",
                          color: l.priceChange.hasPriceChange
                            ? l.priceChange.priceDirection === "down"
                              ? "#34d399"
                              : "#f87171"
                            : "#475569",
                          fontSize: "12px",
                          fontWeight: l.priceChange.hasPriceChange ? 600 : 400,
                        }}>
                          {l._count.snapshots}
                          {l.priceChange.hasPriceChange && (
                            <span style={{ marginLeft: "3px" }}>
                              {l.priceChange.priceDirection === "down" ? "↓" : l.priceChange.priceDirection === "up" ? "↑" : ""}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...s.td, color: "#94a3b8", fontSize: "13px", whiteSpace: "nowrap" }}>
                      {l.postedAt ? formatDate(l.postedAt) : "—"}
                    </td>
                    <td style={{ ...s.td, color: "#94a3b8", fontSize: "13px", whiteSpace: "nowrap" }}>
                      {formatDate(l.lastSeenAt)}
                    </td>
                    <td style={s.td}>
                      {l.aiReview ? (
                        <span
                          title={l.aiReview.reason || "AI reviewed"}
                          style={{
                            ...s.badge,
                            background: l.aiReview.flagged
                              ? "rgba(251, 191, 36, 0.15)"
                              : "rgba(34, 197, 94, 0.1)",
                            color: l.aiReview.flagged ? "#fbbf24" : "#4ade80",
                            fontSize: "11px",
                            cursor: "help",
                          }}
                        >
                          {l.aiReview.flagged ? "⚠" : "✓"} {(l.aiReview.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span style={{ color: "#334155", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                    <td style={s.td}>
                      <span style={{
                        ...s.statusPill,
                        background: l.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: l.isActive ? "#4ade80" : "#f87171",
                      }}>
                        {l.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div style={s.pagination}>
          <button
            style={{ ...s.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Prev
          </button>
          <span style={s.pageInfo}>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            style={{ ...s.pageBtn, opacity: page >= data.totalPages ? 0.4 : 1 }}
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    marginTop: "32px",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: "12px",
    marginBottom: "16px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#f8fafc",
    margin: 0,
  },
  count: {
    fontSize: "14px",
    color: "#64748b",
    fontWeight: 400,
  },
  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
    flexWrap: "wrap" as const,
  },
  select: {
    padding: "8px 12px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "13px",
    cursor: "pointer",
    outline: "none",
  },
  searchWrap: {
    display: "flex",
    flex: 1,
    minWidth: "200px",
    maxWidth: "320px",
  },
  searchInput: {
    flex: 1,
    padding: "8px 12px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRight: "none",
    borderRadius: "8px 0 0 8px",
    color: "#e2e8f0",
    fontSize: "13px",
    outline: "none",
  },
  searchBtn: {
    padding: "8px 12px",
    background: "#1e293b",
    border: "1px solid #1e293b",
    borderRadius: "0 8px 8px 0",
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  tableWrap: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "14px",
  },
  th: {
    textAlign: "left" as const,
    padding: "12px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #1e293b",
    whiteSpace: "nowrap" as const,
    userSelect: "none" as const,
  },
  tr: {
    borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
    transition: "background 0.1s",
  },
  td: {
    padding: "10px 14px",
    verticalAlign: "top" as const,
  },
  thumb: {
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "#1e293b",
    flexShrink: 0,
  },
  thumbImg: {
    width: "40px",
    height: "40px",
    objectFit: "cover" as const,
    display: "block",
  },
  thumbPlaceholder: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1e293b",
  },
  titleCell: {
    maxWidth: "280px",
  },
  titleLink: {
    color: "#e2e8f0",
    textDecoration: "none",
    fontWeight: 500,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  badge: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  },
  typeBadge: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 500,
    background: "rgba(148, 163, 184, 0.1)",
    color: "#94a3b8",
  },
  statusPill: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 500,
  },
  expandedInfo: {
    marginTop: "8px",
    padding: "10px 0",
    borderTop: "1px solid #1e293b",
  },
  expandRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "4px",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  expandLabel: {
    color: "#64748b",
    flexShrink: 0,
    minWidth: "90px",
  },
  expandValue: {
    color: "#cbd5e1",
  },
  snapshotTimeline: {
    marginTop: "6px",
    marginLeft: "98px",
    padding: "8px 12px",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    maxHeight: "200px",
    overflowY: "auto" as const,
  },
  snapRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "3px 0",
    fontSize: "12px",
    borderBottom: "1px solid rgba(30, 41, 59, 0.4)",
  },
  snapDate: {
    color: "#64748b",
    minWidth: "100px",
    flexShrink: 0,
  },
  snapPrice: {
    color: "#e2e8f0",
    fontVariantNumeric: "tabular-nums",
    minWidth: "100px",
  },
  snapOriginal: {
    color: "#475569",
    fontSize: "11px",
  },
  loadingMsg: {
    padding: "40px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: "14px",
  },
  emptyMsg: {
    padding: "48px 24px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    marginTop: "16px",
  },
  pageBtn: {
    padding: "8px 16px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
  },
  pageInfo: {
    color: "#94a3b8",
    fontSize: "13px",
  },
};
