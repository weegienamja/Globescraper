"use client";

import React, { useState, useMemo } from "react";

/* ── Types ───────────────────────────────────────────────── */

interface MoverRow {
  rank: number;
  district: string;
  change1m: number | null;
  change3m: number | null;
  median: number | null;
  volatility: number;
  listingCount: number;
}

interface Props {
  data: MoverRow[];
}

type SortKey = "rank" | "district" | "change1m" | "change3m" | "median" | "volatility" | "listingCount";

/* ── Component ───────────────────────────────────────────── */

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
  borderBottom: "1px solid #1e293b",
  background: "rgba(15,23,42,0.8)",
  cursor: "pointer",
  userSelect: "none",
};
const tdBase: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid rgba(30,41,59,0.5)" };

export function TopMoversTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (typeof av === "string" && typeof bv === "string")
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [data, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((p) => !p);
    } else {
      setSortKey(key);
      setSortAsc(key === "rank" || key === "district");
    }
  };

  const headers: { key: SortKey; label: string }[] = [
    { key: "rank", label: "#" },
    { key: "district", label: "District" },
    { key: "change1m", label: "1M %" },
    { key: "change3m", label: "3M %" },
    { key: "median", label: "Median" },
    { key: "volatility", label: "Vol." },
    { key: "listingCount", label: "Listings" },
  ];

  if (data.length === 0) {
    return (
      <div style={{ height: 160, background: "rgba(15,23,42,0.4)", borderRadius: 12, border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>No mover data available.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #1e293b" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h.key} onClick={() => handleSort(h.key)} style={thStyle}>
                {h.label}
                {sortKey === h.key && (
                  <span style={{ marginLeft: 4, color: "#94a3b8" }}>{sortAsc ? "\u25B2" : "\u25BC"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.district}
              style={{ transition: "background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,23,42,0.6)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <td style={{ ...tdBase, fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{row.rank}</td>
              <td style={{ ...tdBase, fontWeight: 500, color: "#e2e8f0" }}>{row.district}</td>
              <td style={{ ...tdBase, fontWeight: 600, color: changeColorInline(row.change1m) }}>{fmtChange(row.change1m)}</td>
              <td style={{ ...tdBase, fontWeight: 600, color: changeColorInline(row.change3m) }}>{fmtChange(row.change3m)}</td>
              <td style={{ ...tdBase, color: "#e2e8f0" }}>{row.median !== null ? `$${Math.round(row.median).toLocaleString()}` : "\u2014"}</td>
              <td style={{ ...tdBase, color: "#94a3b8" }}>{row.volatility.toFixed(0)}</td>
              <td style={{ ...tdBase, color: "#94a3b8" }}>{row.listingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function changeColorInline(v: number | null): string {
  if (v === null) return "#64748b";
  if (v > 0) return "#34d399";
  if (v < 0) return "#f87171";
  return "#94a3b8";
}

function fmtChange(v: number | null): string {
  if (v === null) return "\u2014";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
