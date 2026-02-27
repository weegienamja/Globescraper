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
  isActive: boolean;
  imageUrlsJson: string | null;
  _count: { snapshots: number };
}

interface ListingsData {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── Component ───────────────────────────────────────────── */

export function ListingsTable() {
  const [data, setData] = useState<ListingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [propertyType, setPropertyType] = useState("");
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
  }, [page, source, propertyType, search, sort, order]);

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
    if (s === "KHMER24") return "Khmer24";
    if (s === "REALESTATE_KH") return "Realestate.kh";
    return s;
  };

  const typeLabel = (t: string) => {
    if (t === "CONDO") return "Condo";
    if (t === "APARTMENT") return "Apartment";
    return t;
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
          <option value="KHMER24">Khmer24</option>
          <option value="REALESTATE_KH">Realestate.kh</option>
        </select>
        <select
          style={s.select}
          value={propertyType}
          onChange={(e) => { setPropertyType(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          <option value="CONDO">Condo</option>
          <option value="APARTMENT">Apartment</option>
        </select>
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
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("priceMonthlyUsd")}
                >
                  Price/mo{sortIcon("priceMonthlyUsd")}
                </th>
                <th
                  style={{ ...s.th, cursor: "pointer" }}
                  onClick={() => handleSort("lastSeenAt")}
                >
                  Last Seen{sortIcon("lastSeenAt")}
                </th>
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
                            <div style={s.expandRow}>
                              <span style={s.expandLabel}>Snapshots:</span>
                              <span style={s.expandValue}>{l._count.snapshots}</span>
                            </div>
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
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{
                        ...s.badge,
                        background: l.source === "KHMER24" ? "rgba(99, 102, 241, 0.15)" : "rgba(244, 114, 182, 0.15)",
                        color: l.source === "KHMER24" ? "#818cf8" : "#f472b6",
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
                      {formatDate(l.lastSeenAt)}
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
