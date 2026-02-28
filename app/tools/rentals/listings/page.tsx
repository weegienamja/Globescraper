import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { ListingsTableWrapper } from "@/components/tools/ListingsTableWrapper";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ district?: string }>;
}

export default async function ListingsPage({ searchParams }: Props) {
  await requireAdmin();
  const { district } = await searchParams;

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.container}>
        <div style={pageStyles.header}>
          <Link href="/tools/rentals/heatmap" style={pageStyles.backLink}>
            ← Back to Heatmap
          </Link>
          <h1 style={pageStyles.heading}>
            Rental Listings
            {district && (
              <span style={pageStyles.districtTag}>{district}</span>
            )}
          </h1>
          <p style={pageStyles.subtitle}>
            {district
              ? `Showing listings in ${district}`
              : "Browse all scraped rental listings"}
          </p>
        </div>

        <ListingsTableWrapper initialDistrict={district} />
      </div>
    </div>
  );
}

const pageStyles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
    padding: "32px 24px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: { maxWidth: "1400px", margin: "0 auto" },
  header: { marginBottom: "24px" },
  backLink: {
    color: "#60a5fa",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
    display: "inline-block",
    marginBottom: "12px",
  },
  heading: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#f8fafc",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
  },
  districtTag: {
    fontSize: "16px",
    fontWeight: 500,
    color: "#a5b4fc",
    background: "rgba(99, 102, 241, 0.15)",
    padding: "4px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(99, 102, 241, 0.3)",
  },
  subtitle: { fontSize: "16px", color: "#94a3b8", marginTop: "6px" },
};
