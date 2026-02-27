import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  await requireAdmin();

  return (
    <div className="tools-hub">
      <div className="tools-hub__inner">
        <h1 className="tools-hub__title">Admin Tools</h1>
        <p className="tools-hub__subtitle">Internal tools for managing GlobeScraper data pipelines.</p>

        <div className="tools-hub__grid">
          <Link href="/tools/rentals" className="tools-hub__card">
            <div className="tools-hub__card-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h2 className="tools-hub__card-title">Rental Data Pipeline</h2>
            <p className="tools-hub__card-desc">
              Scrape, process, and index rental listings from Khmer24 and Realestate.com.kh.
              Build daily rental price indices for heatmap visualization.
            </p>
            <span className="tools-hub__card-action">Open Dashboard →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
