"use client";

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
          height: "calc(100vh - 44px)",
          background: "#0f172a",
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

interface Props {
  data: DistrictIndexRow[];
  totalListings: number;
}

export function EmbedHeatmapClient({ data, totalListings }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Map fills remaining space */}
      <div style={{ flex: 1, padding: "8px 8px 0", minHeight: 0 }}>
        <InteractiveHeatmap
          data={data}
          height={0} /* overridden by CSS flex */
          showListingPoints={false}
          listingsLinkBase="/rentals"
        />
        {/* Override the fixed height — fill the container */}
        <style>{`
          .leaflet-container { height: 100% !important; }
        `}</style>
      </div>

      {/* Sticky attribution bar — always visible, cannot be removed via CSS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "10px 16px",
          background: "#0f172a",
          borderTop: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          Powered by{" "}
          <a
            href="https://globescraper.com/rentals/heatmap"
            target="_blank"
            rel="noopener"
            style={{
              color: "#60a5fa",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            GlobeScraper.com
          </a>
        </span>
        <span style={{ fontSize: "11px", color: "#475569" }}>
          · {totalListings.toLocaleString()} listings
        </span>
      </div>
    </div>
  );
}
