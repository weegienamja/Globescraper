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
          height: 260,
          background: "#0f172a",
          borderRadius: 10,
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#64748b", fontSize: 13 }}>Loading map…</p>
      </div>
    ),
  },
);

interface Props {
  data: DistrictIndexRow[];
  totalListings: number;
}

export function HeatmapPreviewCard({ data, totalListings }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside className="heatmap-preview">
      {/* Mobile toggle button — visible only on small screens */}
      <button
        type="button"
        className="heatmap-preview__mobile-toggle"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
      >
        <span>Heatmap</span>
        <svg
          className={"heatmap-preview__chevron" + (mobileOpen ? " heatmap-preview__chevron--open" : "")}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Content: always visible on desktop, collapsible on mobile */}
      <div className={"heatmap-preview__body" + (mobileOpen ? " heatmap-preview__body--open" : "")}>
        <h2 className="heatmap-preview__title">Rental Heatmap</h2>
        <p className="heatmap-preview__subtitle">
          Median prices across {totalListings.toLocaleString()} listings
        </p>
        <div className="heatmap-preview__map">
          <InteractiveHeatmap
            data={data}
            height={260}
            showListingPoints={false}
            listingsLinkBase="/rentals"
            hideFilters
          />
        </div>
        {/* Legend */}
        <div className="heatmap-preview__legend">
          {[
            { color: "#22c55e", label: "< $300" },
            { color: "#f59e0b", label: "$300–600" },
            { color: "#f97316", label: "$600–1K" },
            { color: "#ef4444", label: "> $1K" },
          ].map(({ color, label }) => (
            <div key={label} className="heatmap-preview__legend-item">
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <a href="/rentals/heatmap" className="heatmap-preview__link">
          View Full Heatmap →
        </a>
      </div>
    </aside>
  );
}
