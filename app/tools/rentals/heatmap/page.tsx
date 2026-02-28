import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import dynamic from "next/dynamic";

const InteractiveHeatmap = dynamic(
  () => import("@/components/tools/InteractiveHeatmap").then((m) => m.InteractiveHeatmap),
  { ssr: false, loading: () => (
    <div style={{ height: 450, background: "#0f172a", borderRadius: 10, border: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#64748b", fontSize: 14 }}>Loading map…</p>
    </div>
  )}
);

export const revalidate = 0; // force-dynamic equivalent

export default async function HeatmapPage() {
  await requireAdmin();

  // Always aggregate directly from all active listings
  // This is more reliable than the daily index which only covers one day's snapshots
  const listings = await prisma.rentalListing.findMany({
    where: { isActive: true },
    select: {
      district: true,
      city: true,
      bedrooms: true,
      propertyType: true,
      priceMonthlyUsd: true,
    },
  });

  type HeatmapRow = {
    district: string | null;
    city: string | null;
    bedrooms: number | null;
    propertyType: string;
    listingCount: number;
    medianPriceUsd: number | null;
    p25PriceUsd: number | null;
    p75PriceUsd: number | null;
  };

  // Group by district + propertyType + bedrooms
  const groups = new Map<string, { district: string | null; city: string | null; bedrooms: number | null; propertyType: string; prices: number[] }>();
  for (const l of listings) {
    const key = `${l.district}|${l.propertyType}|${l.bedrooms}`;
    if (!groups.has(key)) {
      groups.set(key, { district: l.district, city: l.city, bedrooms: l.bedrooms, propertyType: l.propertyType || "Unknown", prices: [] });
    }
    if (l.priceMonthlyUsd !== null) groups.get(key)!.prices.push(l.priceMonthlyUsd);
  }

  const displayData: HeatmapRow[] = [];
  for (const g of groups.values()) {
    const sorted = g.prices.sort((a, b) => a - b);
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
    const p25 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.25)] : null;
    const p75 = sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.75)] : null;
    displayData.push({
      district: g.district,
      city: g.city,
      bedrooms: g.bedrooms,
      propertyType: g.propertyType,
      listingCount: sorted.length,
      medianPriceUsd: median,
      p25PriceUsd: p25,
      p75PriceUsd: p75,
    });
  }
  displayData.sort((a, b) => (b.medianPriceUsd ?? 0) - (a.medianPriceUsd ?? 0));

  const formatPrice = (v: number | null) =>
    v !== null ? `$${Math.round(v).toLocaleString()}` : "—";

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.container}>
        <div style={pageStyles.header}>
          <Link href="/tools/rentals" style={pageStyles.backLink}>
            ← Back to Pipeline
          </Link>
          <h1 style={pageStyles.heading}>Rental Heatmap</h1>
          <p style={pageStyles.subtitle}>
            District-level rental price analysis for Cambodia.
          </p>
        </div>

        {/* Interactive Map */}
        <div style={pageStyles.mapCard}>
          <h2 style={pageStyles.sectionTitle}>
            Map View
            {displayData.length > 0 && (
              <span style={pageStyles.dateTag}>
                {listings.length} active listings
              </span>
            )}
          </h2>
          <InteractiveHeatmap data={displayData} height={450} />

          {/* Legend */}
          <div style={{ ...pageStyles.legend, marginTop: "16px" }}>
            {[
              { color: "#22c55e", label: "< $300/mo" },
              { color: "#f59e0b", label: "$300 – $600/mo" },
              { color: "#f97316", label: "$600 – $1,000/mo" },
              { color: "#ef4444", label: "> $1,000/mo" },
            ].map(({ color, label }) => (
              <div key={label} style={pageStyles.legendItem}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
                <span style={pageStyles.legendLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div style={pageStyles.tableCard}>
          <h2 style={pageStyles.sectionTitle}>
            Price Index by District
            {displayData.length > 0 && (
              <span style={pageStyles.dateTag}>
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </h2>

          {displayData.length === 0 ? (
            <div style={pageStyles.empty}>
              No data available yet. Run &ldquo;Discover&rdquo; and &ldquo;Process Queue&rdquo; from the pipeline dashboard.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>District</th>
                    <th style={pageStyles.th}>Type</th>
                    <th style={{ ...pageStyles.th, textAlign: "center" }}>Beds</th>
                    <th style={{ ...pageStyles.th, textAlign: "right" }}>Median</th>
                    <th style={{ ...pageStyles.th, textAlign: "right" }}>P25</th>
                    <th style={{ ...pageStyles.th, textAlign: "right" }}>P75</th>
                    <th style={{ ...pageStyles.th, textAlign: "right" }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row, i) => (
                    <tr key={i} style={pageStyles.tr}>
                      <td style={{ ...pageStyles.td, color: "#e2e8f0", fontWeight: 500 }}>
                        {row.district || "Unknown"}
                      </td>
                      <td style={pageStyles.td}>{row.propertyType}</td>
                      <td style={{ ...pageStyles.td, textAlign: "center" }}>
                        {row.bedrooms ?? "—"}
                      </td>
                      <td style={{ ...pageStyles.td, textAlign: "right", color: "#e2e8f0", fontWeight: 600 }}>
                        {formatPrice(row.medianPriceUsd)}
                      </td>
                      <td style={{ ...pageStyles.td, textAlign: "right" }}>
                        {formatPrice(row.p25PriceUsd)}
                      </td>
                      <td style={{ ...pageStyles.td, textAlign: "right" }}>
                        {formatPrice(row.p75PriceUsd)}
                      </td>
                      <td style={{ ...pageStyles.td, textAlign: "right" }}>
                        {row.listingCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pageStyles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
    padding: "32px 24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: { maxWidth: "1200px", margin: "0 auto" },
  header: { marginBottom: "32px" },
  backLink: {
    color: "#60a5fa",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
    display: "inline-block",
    marginBottom: "12px",
  },
  heading: { fontSize: "32px", fontWeight: 700, color: "#f8fafc", margin: 0 },
  subtitle: { fontSize: "16px", color: "#94a3b8", marginTop: "6px" },
  mapCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#f8fafc",
    marginBottom: "16px",
    marginTop: 0,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  dateTag: {
    fontSize: "13px",
    color: "#94a3b8",
    fontWeight: 400,
    background: "#1e293b",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  legend: { display: "flex", gap: "24px", flexWrap: "wrap" as const },
  legendItem: { display: "flex", alignItems: "center", gap: "8px" },
  legendLabel: { fontSize: "13px", color: "#cbd5e1" },
  tableCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "24px",
  },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "14px" },
  th: {
    padding: "10px 14px",
    textAlign: "left" as const,
    fontSize: "12px",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #1e293b",
    whiteSpace: "nowrap" as const,
  },
  tr: { borderBottom: "1px solid #1e293b" },
  td: { padding: "10px 14px", color: "#94a3b8", whiteSpace: "nowrap" as const },
  empty: {
    padding: "40px 24px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: "14px",
  },
};
