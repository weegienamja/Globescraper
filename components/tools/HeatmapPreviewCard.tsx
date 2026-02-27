"use client";

import React from "react";
import Link from "next/link";

/**
 * Heatmap Preview Card – placeholder shown on the rental pipeline dashboard.
 * Shows a static placeholder and color legend for future Mapbox/Leaflet integration.
 */
export function HeatmapPreviewCard() {
  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Heatmap Preview</h2>

      {/* Placeholder map area */}
      <div style={styles.mapPlaceholder}>
        <div style={styles.mapInner}>
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
          <p style={styles.mapText}>
            Map visualization coming soon
          </p>
          <p style={styles.mapSubtext}>
            Phnom Penh district-level rental price heatmap
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <LegendItem color="#22c55e" label="< $300" />
        <LegendItem color="#f59e0b" label="$300 - $600" />
        <LegendItem color="#f97316" label="$660 - $1000" />
        <LegendItem color="#ef4444" label="> $1000" />
      </div>

      <Link href="/tools/rentals/heatmap" style={styles.link}>
        View Full Heatmap →
      </Link>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={styles.legendItem}>
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "3px",
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={styles.legendLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px",
    backdropFilter: "blur(8px)",
  },
  title: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#f8fafc",
    marginBottom: "16px",
    marginTop: 0,
  },
  mapPlaceholder: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    borderRadius: "10px",
    border: "1px solid #334155",
    height: "260px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    position: "relative" as const,
    overflow: "hidden",
  },
  mapInner: {
    textAlign: "center" as const,
  },
  mapText: {
    color: "#64748b",
    fontSize: "14px",
    marginTop: "12px",
    fontWeight: 500,
  },
  mapSubtext: {
    color: "#475569",
    fontSize: "12px",
    marginTop: "4px",
  },
  legend: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    marginBottom: "16px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  legendLabel: {
    fontSize: "13px",
    color: "#cbd5e1",
  },
  link: {
    display: "block",
    textAlign: "center" as const,
    color: "#60a5fa",
    fontSize: "13px",
    textDecoration: "none",
    fontWeight: 500,
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #1e3a5f",
    background: "rgba(37, 99, 235, 0.1)",
    transition: "background 0.15s",
  },
};
