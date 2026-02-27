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
          <Link href="/tools/rentals" className="tools-hub__card tools-hub__card--has-preview">
            <div className="tools-hub__card-preview">
              <svg width="100%" height="100%" viewBox="0 0 320 160" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="320" height="160" fill="#0c1222" />
                {/* Header bar */}
                <rect x="12" y="10" width="80" height="6" rx="3" fill="#f8fafc" opacity="0.9" />
                <rect x="12" y="20" width="120" height="4" rx="2" fill="#64748b" opacity="0.5" />
                {/* Action buttons */}
                <rect x="12" y="32" width="56" height="14" rx="4" fill="#2563eb" />
                <rect x="18" y="37" width="44" height="4" rx="2" fill="#fff" opacity="0.9" />
                <rect x="74" y="32" width="56" height="14" rx="4" fill="#7c3aed" />
                <rect x="80" y="37" width="44" height="4" rx="2" fill="#fff" opacity="0.9" />
                <rect x="136" y="32" width="56" height="14" rx="4" fill="#059669" />
                <rect x="142" y="37" width="44" height="4" rx="2" fill="#fff" opacity="0.9" />
                {/* Stat cards row */}
                <rect x="12" y="54" width="70" height="36" rx="6" fill="#1e293b" />
                <rect x="20" y="62" width="24" height="8" rx="2" fill="#60a5fa" opacity="0.8" />
                <rect x="20" y="74" width="40" height="4" rx="2" fill="#475569" />
                <rect x="88" y="54" width="70" height="36" rx="6" fill="#1e293b" />
                <rect x="96" y="62" width="20" height="8" rx="2" fill="#34d399" opacity="0.8" />
                <rect x="96" y="74" width="36" height="4" rx="2" fill="#475569" />
                <rect x="164" y="54" width="70" height="36" rx="6" fill="#1e293b" />
                <rect x="172" y="62" width="28" height="8" rx="2" fill="#fbbf24" opacity="0.8" />
                <rect x="172" y="74" width="32" height="4" rx="2" fill="#475569" />
                <rect x="240" y="54" width="70" height="36" rx="6" fill="#1e293b" />
                <rect x="248" y="62" width="18" height="8" rx="2" fill="#f87171" opacity="0.8" />
                <rect x="248" y="74" width="44" height="4" rx="2" fill="#475569" />
                {/* Table rows */}
                <rect x="12" y="98" width="298" height="1" fill="#1e293b" />
                <rect x="12" y="104" width="40" height="4" rx="2" fill="#475569" />
                <rect x="60" y="104" width="60" height="4" rx="2" fill="#cbd5e1" opacity="0.4" />
                <rect x="130" y="104" width="30" height="4" rx="2" fill="#475569" />
                <rect x="250" y="103" width="32" height="6" rx="3" fill="#22c55e" opacity="0.3" />
                <rect x="256" y="105" width="20" height="2" rx="1" fill="#22c55e" />
                <rect x="12" y="114" width="298" height="1" fill="#1e293b" />
                <rect x="12" y="120" width="36" height="4" rx="2" fill="#475569" />
                <rect x="60" y="120" width="52" height="4" rx="2" fill="#cbd5e1" opacity="0.4" />
                <rect x="130" y="120" width="24" height="4" rx="2" fill="#475569" />
                <rect x="250" y="119" width="32" height="6" rx="3" fill="#22c55e" opacity="0.3" />
                <rect x="256" y="121" width="20" height="2" rx="1" fill="#22c55e" />
                <rect x="12" y="130" width="298" height="1" fill="#1e293b" />
                <rect x="12" y="136" width="44" height="4" rx="2" fill="#475569" />
                <rect x="60" y="136" width="48" height="4" rx="2" fill="#cbd5e1" opacity="0.4" />
                <rect x="130" y="136" width="28" height="4" rx="2" fill="#475569" />
                <rect x="250" y="135" width="32" height="6" rx="3" fill="#ef4444" opacity="0.3" />
                <rect x="256" y="137" width="20" height="2" rx="1" fill="#ef4444" />
                {/* Heatmap mini in corner */}
                <rect x="240" y="32" width="70" height="56" rx="6" fill="#1e293b" />
                <rect x="248" y="40" width="12" height="12" rx="2" fill="#22c55e" opacity="0.4" />
                <rect x="262" y="40" width="12" height="12" rx="2" fill="#f59e0b" opacity="0.4" />
                <rect x="276" y="40" width="12" height="12" rx="2" fill="#ef4444" opacity="0.3" />
                <rect x="248" y="54" width="12" height="12" rx="2" fill="#f59e0b" opacity="0.4" />
                <rect x="262" y="54" width="12" height="12" rx="2" fill="#22c55e" opacity="0.5" />
                <rect x="276" y="54" width="12" height="12" rx="2" fill="#f59e0b" opacity="0.3" />
                <rect x="248" y="68" width="12" height="12" rx="2" fill="#ef4444" opacity="0.4" />
                <rect x="262" y="68" width="12" height="12" rx="2" fill="#22c55e" opacity="0.3" />
                <rect x="276" y="68" width="12" height="12" rx="2" fill="#22c55e" opacity="0.5" />
              </svg>
            </div>
            <div className="tools-hub__card-body">
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
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
