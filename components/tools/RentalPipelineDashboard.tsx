"use client";

import { useEffect, useState, useCallback } from "react";
import { JobRunsTable } from "./JobRunsTable";
import { HeatmapPreviewCard } from "./HeatmapPreviewCard";

/* ── Types ───────────────────────────────────────────────── */

interface JobRun {
  id: string;
  jobType: string;
  source: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  discoveredCount: number;
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  snapshotCount: number;
  indexRowsCount: number;
  errorMessage: string | null;
}

interface Summary {
  totalListings: number;
  listingsToday: number;
  totalSnapshots: number;
  lastUpdated: string | null;
  sourceCounts: { KHMER24: number; REALESTATE_KH: number };
  recentJobs: JobRun[];
  marketOverview: {
    city: string;
    activeListings: number;
    medianPriceUsd: number | null;
    lastIndexDate: string | null;
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getListingsCount(job: JobRun): number {
  return (
    job.discoveredCount ||
    job.processedCount ||
    job.insertedCount + job.updatedCount ||
    job.indexRowsCount ||
    0
  );
}

/* ── Component ───────────────────────────────────────────── */

export function RentalPipelineDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/rentals/summary");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const runJob = async (
    endpoint: string,
    label: string,
    params?: string
  ) => {
    setRunningJob(label);
    try {
      const url = `/api/tools/rentals/${endpoint}${params ? `?${params}` : ""}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast({ message: `${label} completed successfully`, type: "success" });
      await fetchSummary();
    } catch (err) {
      setToast({
        message: `${label} failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        type: "error",
      });
    } finally {
      setRunningJob(null);
    }
  };

  /* ── Skeleton ──────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ ...styles.skeleton, width: "400px", height: "40px" }} />
          <div style={{ ...styles.skeleton, width: "300px", height: "20px", marginTop: "8px" }} />
          <div style={{ display: "flex", gap: "16px", marginTop: "32px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ ...styles.skeleton, width: "220px", height: "52px", borderRadius: "12px" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ ...styles.skeleton, flex: 1, height: "100px", borderRadius: "12px" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────── */

  if (error && !summary) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.errorCard}>
            <h2 style={{ color: "#fda4af", margin: 0 }}>Failed to load dashboard</h2>
            <p style={{ color: "#94a3b8", marginTop: "8px" }}>{error}</p>
            <button style={styles.retryBtn} onClick={fetchSummary}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const sourceLabel = (s: string | null) => {
    if (s === "KHMER24") return "Khmer24";
    if (s === "REALESTATE_KH") return "Realestate.com.kh";
    return "All Sources";
  };

  return (
    <div style={styles.page}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            ...(toast.type === "error" ? styles.toastError : styles.toastSuccess),
          }}
        >
          {toast.message}
          <button
            style={styles.toastClose}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      <div style={styles.container}>
        {/* Header */}
        <h1 style={styles.heading}>Rental Data Pipeline</h1>
        <p style={styles.subtitle}>Manage and monitor your rental data scraping jobs.</p>

        {/* Action Buttons */}
        <div style={styles.actionsRow}>
          <button
            style={{
              ...styles.actionBtn,
              opacity: runningJob ? 0.6 : 1,
            }}
            disabled={!!runningJob}
            onClick={() => runJob("discover", "Discover New Listings", "source=KHMER24")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            {runningJob === "Discover New Listings" ? "Running..." : "Discover New Listings"}
          </button>
          <button
            style={{
              ...styles.actionBtn,
              opacity: runningJob ? 0.6 : 1,
            }}
            disabled={!!runningJob}
            onClick={() => runJob("process-queue", "Process Queue Batch", "source=KHMER24")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            {runningJob === "Process Queue Batch" ? "Running..." : "Process Queue Batch"}
          </button>
          <button
            style={{
              ...styles.actionBtn,
              opacity: runningJob ? 0.6 : 1,
            }}
            disabled={!!runningJob}
            onClick={() => runJob("build-index", "Build Daily Index")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {runningJob === "Build Daily Index" ? "Running..." : "Build Daily Index"}
          </button>
        </div>

        {/* Stats Cards */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Listings</div>
            <div style={styles.statValue}>
              {summary.totalListings.toLocaleString()}
            </div>
            <div style={styles.statMeta}>
              Khmer24 | Realestate.com.kh
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Listings Added Today</div>
            <div style={styles.statValue}>{summary.listingsToday}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Snapshots Recorded</div>
            <div style={styles.statValue}>
              {summary.totalSnapshots.toLocaleString()}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Last Updated</div>
            <div style={{ ...styles.statValue, fontSize: "16px" }}>
              {formatDate(summary.lastUpdated)}
            </div>
          </div>
        </div>

        {/* Two-column: Job Runs + Heatmap */}
        <div style={styles.twoColumn}>
          <div style={styles.columnMain}>
            <h2 style={styles.sectionTitle}>Recent Job Runs</h2>
            <JobRunsTable
              jobs={summary.recentJobs}
              formatDuration={formatDuration}
              sourceLabel={sourceLabel}
              getListingsCount={getListingsCount}
            />
          </div>
          <div style={styles.columnSide}>
            <HeatmapPreviewCard />
          </div>
        </div>

        {/* Market Overview */}
        <div style={styles.marketOverview}>
          <h2 style={styles.marketTitle}>Rental Market Overview</h2>
          <div style={styles.marketStats}>
            <div style={styles.marketStat}>
              <span style={styles.marketStatLabel}>Phnom Penh:</span>
              <span style={styles.marketStatValue}>
                {summary.marketOverview.activeListings.toLocaleString()} Listings
              </span>
            </div>
            <div style={styles.marketStat}>
              <span style={styles.marketStatLabel}>Median Price:</span>
              <span style={styles.marketStatValue}>
                {summary.marketOverview.medianPriceUsd
                  ? `$${summary.marketOverview.medianPriceUsd} / month`
                  : "—"}
              </span>
            </div>
            <div style={styles.marketStat}>
              <span style={styles.marketStatLabel}>Updated:</span>
              <span style={styles.marketStatValue}>
                {formatDate(summary.marketOverview.lastIndexDate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inline Styles (dark dashboard) ──────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
    padding: "32px 24px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: "1300px",
    margin: "0 auto",
  },
  heading: {
    fontSize: "36px",
    fontWeight: 700,
    color: "#f8fafc",
    margin: 0,
  },
  subtitle: {
    fontSize: "16px",
    color: "#94a3b8",
    marginTop: "6px",
    marginBottom: "0",
  },
  actionsRow: {
    display: "flex",
    gap: "16px",
    marginTop: "28px",
    flexWrap: "wrap" as const,
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 24px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    color: "#e2e8f0",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginTop: "28px",
  },
  statCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px 24px",
    backdropFilter: "blur(8px)",
  },
  statLabel: {
    fontSize: "13px",
    color: "#94a3b8",
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#f8fafc",
    marginTop: "4px",
  },
  statMeta: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: "24px",
    marginTop: "32px",
    alignItems: "start",
  },
  columnMain: {
    minWidth: 0,
  },
  columnSide: {},
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#f8fafc",
    marginBottom: "16px",
  },
  marketOverview: {
    marginTop: "32px",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px 28px",
  },
  marketTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#f8fafc",
    marginBottom: "12px",
  },
  marketStats: {
    display: "flex",
    gap: "40px",
    flexWrap: "wrap" as const,
  },
  marketStat: {
    display: "flex",
    gap: "8px",
    alignItems: "baseline",
  },
  marketStatLabel: {
    fontSize: "14px",
    color: "#94a3b8",
  },
  marketStatValue: {
    fontSize: "14px",
    color: "#e2e8f0",
    fontWeight: 500,
  },
  skeleton: {
    background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: "8px",
    height: "20px",
  },
  errorCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #7f1d1d",
    borderRadius: "12px",
    padding: "32px",
    textAlign: "center" as const,
  },
  retryBtn: {
    marginTop: "16px",
    padding: "10px 24px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: "14px",
  },
  toast: {
    position: "fixed" as const,
    top: "20px",
    right: "20px",
    padding: "14px 20px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 500,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  toastSuccess: {
    background: "rgba(6, 78, 59, 0.9)",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    color: "#6ee7b7",
  },
  toastError: {
    background: "rgba(127, 29, 29, 0.9)",
    border: "1px solid rgba(244, 63, 94, 0.4)",
    color: "#fda4af",
  },
  toastClose: {
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 4px",
    opacity: 0.7,
  },
};
