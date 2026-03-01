"use client";

import { useState, useCallback, useEffect } from "react";
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

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
          <div style={{ position: "relative" }}>
            <InteractiveHeatmap
              data={data}
              height={520}
              showListingPoints={false}
              listingsLinkBase="/rentals"
            />
            {/* Enlarge button */}
            <button
              onClick={toggleFullscreen}
              style={s.enlargeBtn}
              aria-label="View fullscreen"
              title="Enlarge map"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

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

        {/* Fullscreen overlay */}
        {isFullscreen && (
          <div style={s.fullscreenOverlay}>
            <div style={s.fullscreenHeader}>
              <h2 style={s.fullscreenTitle}>Cambodia Rental Heatmap</h2>
              <button
                onClick={toggleFullscreen}
                style={s.fullscreenClose}
                aria-label="Close fullscreen"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, padding: "0 16px 16px" }}>
              <InteractiveHeatmap
                data={data}
                height="calc(100vh - 72px)"
                showListingPoints={false}
                listingsLinkBase="/rentals"
              />
            </div>
          </div>
        )}

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

        {/* SEO content — about this project */}
        <article style={s.articleCard}>
          <h2 style={s.articleHeading}>About the Cambodia Rental Heatmap</h2>
          <p style={s.articleText}>
            This interactive heatmap visualises median monthly rental prices
            across Cambodia at the district level. Data is aggregated from
            publicly available rental listings on leading property platforms
            including{" "}
            <a href="https://www.realestate.com.kh" target="_blank" rel="noopener noreferrer" style={s.articleLink}>
              Realestate.com.kh
            </a>,{" "}
            <a href="https://www.khmer24.com" target="_blank" rel="noopener noreferrer" style={s.articleLink}>
              Khmer24
            </a>, and others.
          </p>

          <h3 style={s.articleSubheading}>How It Works</h3>
          <p style={s.articleText}>
            New listings are collected daily and matched to their geographic
            district using address data, coordinates, and boundary mapping.
            Prices are normalised to US dollars per month so properties can be
            compared consistently across sources. The map updates approximately
            every hour as fresh data is processed.
          </p>

          <h3 style={s.articleSubheading}>Ongoing Project &amp; Data Quality</h3>
          <p style={s.articleText}>
            This is an ongoing, evolving project. While we work hard to keep the
            data accurate, occasional errors may appear. A listing might be
            mapped to the wrong district, a price could be mis-converted, or
            duplicate entries may slip through before being detected. We are
            continuously improving our data pipeline and resolving issues as they
            are found.
          </p>

          <h3 style={s.articleSubheading}>Cambodia Rental Market Overview</h3>
          <p style={s.articleText}>
            Cambodia&apos;s rental market is concentrated in Phnom Penh, Siem Reap,
            and Sihanoukville, but growing demand is spreading to secondary
            cities and provincial areas. Property types range from affordable
            local apartments under $300 per month to premium serviced apartments,
            villas, and penthouses exceeding $1,000 per month. This heatmap helps
            renters, investors, and researchers quickly identify price trends and
            compare districts side by side.
          </p>
        </article>

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
  enlargeBtn: {
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
  },
  fullscreenOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    animation: "heatmap-fs-in 0.25s ease-out",
  },
  fullscreenHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #1e293b",
    flexShrink: 0,
  },
  fullscreenTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#f8fafc",
    margin: 0,
  },
  fullscreenClose: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#cbd5e1",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  articleCard: {
    background: "rgba(15, 23, 42, 0.4)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "28px 24px",
    marginTop: "24px",
    lineHeight: 1.7,
  },
  articleHeading: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--text-heading, #f8fafc)",
    margin: "0 0 12px",
  },
  articleSubheading: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text-heading, #e2e8f0)",
    margin: "20px 0 8px",
  },
  articleText: {
    fontSize: "0.9375rem",
    color: "var(--text-muted, #94a3b8)",
    margin: "0 0 4px",
  },
  articleLink: {
    color: "#60a5fa",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
};
