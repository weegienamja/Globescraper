"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { DistrictIndexRow } from "@/components/tools/InteractiveHeatmap";

const InteractiveHeatmap = dynamic(
  () =>
    import("@/components/tools/InteractiveHeatmap").then(
      (m) => m.InteractiveHeatmap,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 520,
          background: "#0f172a",
          borderRadius: 10,
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#64748b", fontSize: 14 }}>Loading map…</p>
      </div>
    ),
  },
);

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  data: DistrictIndexRow[];
  totalListings: number;
}

/* ── Component ───────────────────────────────────────────── */

export function PublicHeatmapClient({
  data,
  totalListings,
}: Props) {
  const [copied, setCopied] = useState(false);

  const embedCode = `<iframe src="https://globescraper.com/rentals/heatmap/embed" width="100%" height="600" style="border:none;border-radius:12px" loading="lazy" title="Cambodia Rental Heatmap — GlobeScraper"></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback */
      const ta = document.createElement("textarea");
      ta.value = embedCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <h1 style={s.heading}>Cambodia Rental Heatmap</h1>
          <p style={s.subtitle}>
            District-level rental price analysis across Cambodia.
            Median prices for {totalListings.toLocaleString()} active listings.
          </p>
        </div>

        {/* Map card */}
        <div style={s.mapCard}>
          <InteractiveHeatmap
            data={data}
            height={520}
            showListingPoints={false}
            listingsLinkBase="/rentals"
          />

          {/* Legend */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "16px" }}>
            {[
              { color: "#22c55e", label: "< $300/mo" },
              { color: "#f59e0b", label: "$300 – $600/mo" },
              { color: "#f97316", label: "$600 – $1,000/mo" },
              { color: "#ef4444", label: "> $1,000/mo" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
                <span style={{ fontSize: "13px", color: "#cbd5e1" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Embed section */}
        <div style={s.embedCard}>
          <h2 style={s.embedTitle}>Embed this map</h2>
          <p style={s.embedDesc}>
            Add this interactive rental heatmap to your blog or website.
            Copy the code below and paste it into your HTML.
          </p>
          <div style={s.embedCodeWrap}>
            <code style={s.embedCode}>{embedCode}</code>
            <button
              onClick={handleCopy}
              style={{
                ...s.copyBtn,
                background: copied ? "#059669" : "#3b82f6",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Browse link */}
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <a href="/rentals" style={s.browseLink}>
            Browse all rentals →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 24px 64px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: { maxWidth: "1100px", margin: "0 auto" },
  header: { marginBottom: "28px", textAlign: "center" },
  heading: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "var(--text-heading, #f8fafc)",
    margin: 0,
  },
  subtitle: {
    fontSize: "1rem",
    color: "var(--text-muted, #94a3b8)",
    marginTop: "8px",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  mapCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "24px",
  },
  embedCard: {
    background: "rgba(15, 23, 42, 0.4)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "24px",
    marginTop: "24px",
  },
  embedTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "var(--text-heading, #f8fafc)",
    margin: "0 0 8px",
  },
  embedDesc: {
    fontSize: "0.875rem",
    color: "var(--text-muted, #94a3b8)",
    margin: "0 0 16px",
  },
  embedCodeWrap: {
    display: "flex",
    gap: "12px",
    alignItems: "stretch",
  },
  embedCode: {
    flex: 1,
    display: "block",
    padding: "12px 16px",
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#cbd5e1",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    overflow: "auto",
    whiteSpace: "nowrap",
  },
  copyBtn: {
    padding: "0 20px",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap",
  },
  browseLink: {
    display: "inline-block",
    padding: "12px 28px",
    fontSize: "0.9375rem",
    fontWeight: 600,
    color: "#fff",
    background: "#3b82f6",
    borderRadius: "8px",
    textDecoration: "none",
  },
};
