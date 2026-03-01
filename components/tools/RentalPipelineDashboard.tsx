"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { JobRunsTable } from "./JobRunsTable";
import { HeatmapPreviewCard } from "./HeatmapPreviewCard";
import { ListingsTable } from "./ListingsTable";
import { LiveLogViewer, type LogEntry } from "./LiveLogViewer";

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logConnected, setLogConnected] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; percent: number; label: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* AI Processing state */
  const [rewriteBatches, setRewriteBatches] = useState(5);
  const [rewriteBatchSize, setRewriteBatchSize] = useState(50);
  const [rewriteSequential, setRewriteSequential] = useState(true);
  const [reviewBatches, setReviewBatches] = useState(3);

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
    // Map old endpoint names to the streaming job param
    const jobMap: Record<string, string> = {
      discover: "discover",
      "process-queue": "process-queue",
      "build-index": "build-index",
      "run-all": "run-all",
    };
    const jobName = jobMap[endpoint] ?? endpoint;

    setRunningJob(label);
    setShowLogs(true);
    setLogConnected(true);
    setProgress(null);

    // Add a separator for this run
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        level: "info" as const,
        stage: "system",
        message: `━━━ ${label} started ━━━`,
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const qs = new URLSearchParams({ job: jobName });
      if (params) {
        // Parse existing params (e.g. "source=REALESTATE_KH")
        const extra = new URLSearchParams(params);
        extra.forEach((v, k) => qs.set(k, v));
      }

      const res = await fetch(`/api/tools/rentals/run?${qs}`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (currentEvent === "log") {
                setLogs((prev) => [...prev, parsed as LogEntry]);
              } else if (currentEvent === "progress") {
                setProgress(parsed as { phase: string; percent: number; label: string });
              } else if (currentEvent === "complete") {
                setLogs((prev) => [
                  ...prev,
                  {
                    timestamp: new Date().toISOString(),
                    level: "info" as const,
                    stage: "system",
                    message: `━━━ ${label} completed successfully ━━━`,
                  },
                ]);
                setToast({
                  message: `${label} completed successfully`,
                  type: "success",
                });
                await fetchSummary();
              } else if (currentEvent === "error") {
                throw new Error(parsed.error || "Unknown error");
              }
            } catch (e) {
              if (currentEvent === "error") throw e;
            }
            currentEvent = "message";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          level: "error" as const,
          stage: "system",
          message: `${label} failed: ${msg}`,
        },
      ]);
      setToast({
        message: `${label} failed: ${msg}`,
        type: "error",
      });
    } finally {
      setRunningJob(null);
      setLogConnected(false);
      setProgress(null);
      abortRef.current = null;
      // Always refresh stats after a job finishes (success or failure)
      await fetchSummary();
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
        <p style={styles.subtitle}>Manage and monitor your rental data scraping and processing jobs.</p>

        {/* ═══ Scraping Pipeline Section ═══ */}
        <div style={styles.sectionDivider}>
          <span style={styles.sectionDividerLabel}>Scraping Pipeline</span>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" as const, alignItems: "center" }}>
          <button
            style={{ ...styles.pipelineBtn, opacity: runningJob ? 0.6 : 1 }}
            disabled={!!runningJob}
            onClick={() => runJob("discover", "Discover New Listings")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Discover New Listings
          </button>
          <button
            style={{ ...styles.pipelineBtn, opacity: runningJob ? 0.6 : 1 }}
            disabled={!!runningJob}
            onClick={() => runJob("build-index", "Build Daily Index")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Build Daily Index
          </button>
          <button
            style={{
              ...styles.pipelineBtn,
              borderColor: "#92400e",
              color: "#f59e0b",
              opacity: runningJob ? 0.6 : 1,
            }}
            disabled={!!runningJob}
            onClick={async () => {
              if (!confirm("Fix old listings with breadcrumb-style districts?")) return;
              setRunningJob("Cleaning Data");
              try {
                const res = await fetch("/api/tools/rentals/cleanup", { method: "POST" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setToast({ message: `Cleaned ${data.fixed} of ${data.total} listings`, type: "success" });
                await fetchSummary();
              } catch (err) {
                setToast({ message: `Cleanup failed: ${err instanceof Error ? err.message : err}`, type: "error" });
              } finally {
                setRunningJob(null);
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Clean Up Data
          </button>
          <button
            style={{ ...styles.pipelineBtn, opacity: runningJob ? 0.6 : 1 }}
            disabled={!!runningJob}
            onClick={() => runJob("process-queue", "Process Queue Batch")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            Process Queue Batch
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" as const, alignItems: "center" }}>
          <button
            style={{
              ...styles.pipelineBtn,
              background: showLogs ? "#334155" : "#1e293b",
              borderColor: showLogs ? "#818cf8" : "#334155",
            }}
            onClick={() => setShowLogs((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {showLogs ? "Hide Logs" : "Show Logs"}
            {logs.length > 0 && (
              <span style={{
                fontSize: "11px",
                background: logConnected ? "rgba(74,222,128,0.2)" : "rgba(148,163,184,0.2)",
                color: logConnected ? "#4ade80" : "#94a3b8",
                padding: "1px 7px",
                borderRadius: "8px",
                marginLeft: "2px",
              }}>
                {logs.length}
              </span>
            )}
          </button>
          <a
            href="/tools/rentals/analytics"
            style={{
              ...styles.pipelineBtn,
              borderColor: "#1d4ed8",
              color: "#3b82f6",
              textDecoration: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </a>
        </div>

        {/* ═══ AI Processing Section ═══ */}
        <div style={styles.sectionDivider}>
          <span style={styles.sectionDividerLabel}>AI Processing</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* AI Rewrite Card */}
          <div style={styles.aiCard}>
            <div style={styles.aiCardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span style={styles.aiCardTitle}>AI Rewrite</span>
            </div>
            <div style={styles.aiCardBody}>
              <div style={styles.aiInputGroup}>
                <label style={styles.aiInputLabel}>Run Batches:</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rewriteBatches}
                  onChange={(e) => setRewriteBatches(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.aiNumberInput}
                  disabled={!!runningJob}
                />
              </div>
              <div style={styles.aiInputGroup}>
                <label style={styles.aiInputLabel}>Batch Size:</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rewriteBatchSize}
                  onChange={(e) => setRewriteBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.aiNumberInput}
                  disabled={!!runningJob}
                />
              </div>
              <button
                style={{
                  ...styles.aiStartBtn,
                  opacity: runningJob ? 0.6 : 1,
                }}
                disabled={!!runningJob}
                onClick={async () => {
                  setRunningJob("AI Rewrite");
                  let totalRewritten = 0;
                  let totalTokens = 0;
                  try {
                    for (let i = 0; i < rewriteBatches; i++) {
                      setToast({ message: `AI Rewrite batch ${i + 1}/${rewriteBatches}... (${totalRewritten} done)`, type: "success" });
                      const res = await fetch("/api/tools/rentals/ai-rewrite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ limit: rewriteBatchSize }),
                      });
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                      const data = await res.json();
                      totalRewritten += data.rewritten || 0;
                      totalTokens += data.totalTokens || 0;
                      if (!data.rewritten || data.rewritten === 0) break;
                      if (rewriteSequential && i < rewriteBatches - 1) {
                        await new Promise((r) => setTimeout(r, 1000));
                      }
                    }
                    setToast({ message: `AI Rewrite complete: ${totalRewritten} descriptions (${totalTokens} tokens)`, type: "success" });
                  } catch (err) {
                    setToast({ message: `AI Rewrite failed: ${err instanceof Error ? err.message : err}`, type: "error" });
                  } finally {
                    setRunningJob(null);
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start
              </button>
            </div>
            <label style={styles.aiCheckboxRow}>
              <input
                type="checkbox"
                checked={rewriteSequential}
                onChange={(e) => setRewriteSequential(e.target.checked)}
                style={styles.aiCheckbox}
              />
              <span style={styles.aiCheckboxLabel}>Run Sequentially</span>
            </label>
          </div>

          {/* AI Review Card */}
          <div style={styles.aiCard}>
            <div style={styles.aiCardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span style={styles.aiCardTitle}>AI Review</span>
            </div>
            <div style={styles.aiCardBody}>
              <div style={styles.aiInputGroup}>
                <label style={styles.aiInputLabel}>Review Batches:</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={reviewBatches}
                  onChange={(e) => setReviewBatches(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.aiNumberInput}
                  disabled={!!runningJob}
                />
              </div>
              <div style={{ flex: 1 }} />
              <button
                style={{
                  ...styles.aiStartBtn,
                  opacity: runningJob ? 0.6 : 1,
                }}
                disabled={!!runningJob}
                onClick={async () => {
                  setRunningJob("AI Review");
                  let totalReviewed = 0;
                  let totalFlagged = 0;
                  try {
                    for (let i = 0; i < reviewBatches; i++) {
                      setToast({ message: `AI Review batch ${i + 1}/${reviewBatches}... (${totalReviewed} done)`, type: "success" });
                      const res = await fetch("/api/tools/rentals/ai-reviews", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ limit: 30 }),
                      });
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                      const data = await res.json();
                      totalReviewed += data.reviewed || 0;
                      totalFlagged += data.flagged || 0;
                      if (!data.reviewed || data.reviewed === 0) break;
                      if (i < reviewBatches - 1) {
                        await new Promise((r) => setTimeout(r, 1000));
                      }
                    }
                    setToast({ message: `AI Review complete: ${totalReviewed} reviewed, ${totalFlagged} flagged`, type: "success" });
                  } catch (err) {
                    setToast({ message: `AI Review failed: ${err instanceof Error ? err.message : err}`, type: "error" });
                  } finally {
                    setRunningJob(null);
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {runningJob && progress && (
          <div style={{
            marginTop: "16px",
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "12px",
            padding: "14px 18px",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              fontSize: "13px",
            }}>
              <span style={{ color: "#94a3b8" }}>
                <span style={{
                  display: "inline-block",
                  background: "rgba(99,102,241,0.15)",
                  color: "#818cf8",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginRight: "8px",
                  letterSpacing: "0.5px",
                }}>
                  {progress.phase}
                </span>
                {progress.label}
              </span>
              <span style={{ color: "#e2e8f0", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {progress.percent}%
              </span>
            </div>
            <div style={{
              height: "8px",
              background: "#1e293b",
              borderRadius: "4px",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress.percent}%`,
                background: "linear-gradient(90deg, #6366f1, #818cf8)",
                borderRadius: "4px",
                transition: "width 0.4s ease-out",
              }} />
            </div>
          </div>
        )}

        {/* Live Log Viewer */}
        {showLogs && (
          <LiveLogViewer
            logs={logs}
            isConnected={logConnected}
            onClear={() => setLogs([])}
          />
        )}

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

        {/* Scraped Listings Browser */}
        <ListingsTable />
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
  sectionDivider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "32px",
    marginBottom: "16px",
  },
  sectionDividerLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    whiteSpace: "nowrap" as const,
  },
  pipelineBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 18px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "10px",
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  aiCard: {
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "20px",
    backdropFilter: "blur(8px)",
  },
  aiCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  aiCardTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#f8fafc",
  },
  aiCardBody: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  aiInputGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  aiInputLabel: {
    fontSize: "13px",
    color: "#94a3b8",
    whiteSpace: "nowrap" as const,
  },
  aiNumberInput: {
    width: "60px",
    padding: "6px 8px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "13px",
    textAlign: "center" as const,
  },
  aiStartBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 18px",
    background: "#065f46",
    border: "1px solid #10b981",
    borderRadius: "8px",
    color: "#ecfdf5",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  aiCheckboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "12px",
    cursor: "pointer",
  },
  aiCheckbox: {
    accentColor: "#6366f1",
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  aiCheckboxLabel: {
    fontSize: "13px",
    color: "#94a3b8",
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
