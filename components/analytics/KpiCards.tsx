"use client";

import React from "react";

/* ── Types ───────────────────────────────────────────────── */

interface KpiSummary {
  currentMedian: number | null;
  current1Bed: number | null;
  current2Bed: number | null;
  totalListings: number;
  change1m: number | null;
  change3m: number | null;
  volatility: number;
  volatilityScore: number;
  supplySignal: "oversupply" | "squeeze" | "neutral";
}

interface Props {
  summary: KpiSummary;
}

/* ── Styles ──────────────────────────────────────────────── */

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
};

const cardStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #1e293b",
  background: "rgba(15,23,42,0.6)",
  padding: "20px",
  transition: "all 0.2s ease",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
  margin: 0,
};

const valueStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#e2e8f0",
  margin: "8px 0 0 0",
  lineHeight: 1.2,
};

function badgeStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    marginTop: "8px",
    borderRadius: "6px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 600,
    background: color + "18",
    color: color,
    border: `1px solid ${color}33`,
  };
}

/* ── Component ───────────────────────────────────────────── */

export function KpiCards({ summary }: Props) {
  const cards: {
    label: string;
    value: string;
    change?: number | null;
    badge?: { text: string; color: string };
  }[] = [
    {
      label: "Current Median Rent",
      value: fmtPrice(summary.currentMedian),
      change: summary.change1m,
    },
    {
      label: "1-Bed Median",
      value: fmtPrice(summary.current1Bed),
    },
    {
      label: "2-Bed Median",
      value: fmtPrice(summary.current2Bed),
    },
    {
      label: "Active Listings",
      value: summary.totalListings.toLocaleString(),
    },
    {
      label: "Volatility Score",
      value: `${summary.volatilityScore}/100`,
      badge: volBadge(summary.volatilityScore),
    },
    {
      label: "Supply Pressure",
      value: "",
      badge: supplyBadge(summary.supplySignal),
    },
  ];

  return (
    <div style={gridStyle}>
      {cards.map((card) => (
        <div key={card.label} style={cardStyle}>
          <p style={labelStyle}>{card.label}</p>
          <p style={valueStyle}>
            {card.value || (card.badge ? "" : "\u2014")}
          </p>
          {card.change !== undefined && card.change !== null && (
            <p
              style={{
                marginTop: "4px",
                fontSize: "13px",
                fontWeight: 600,
                color: card.change >= 0 ? "#34d399" : "#f87171",
              }}
            >
              {card.change >= 0 ? "+" : ""}
              {card.change.toFixed(1)}% 1M
            </p>
          )}
          {card.badge && (
            <span style={badgeStyle(card.badge.color)}>
              {card.badge.text}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function fmtPrice(v: number | null): string {
  if (v === null) return "\u2014";
  return `$${Math.round(v).toLocaleString()}`;
}

function volBadge(score: number): { text: string; color: string } {
  if (score < 20) return { text: "Stable", color: "#22c55e" };
  if (score < 50) return { text: "Moderate", color: "#f59e0b" };
  return { text: "High", color: "#ef4444" };
}

function supplyBadge(
  signal: "oversupply" | "squeeze" | "neutral",
): { text: string; color: string } {
  switch (signal) {
    case "oversupply":
      return { text: "Oversupply", color: "#ef4444" };
    case "squeeze":
      return { text: "Demand Squeeze", color: "#f59e0b" };
    case "neutral":
      return { text: "Stable Market", color: "#22c55e" };
  }
}
