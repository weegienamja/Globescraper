"use client";

import React, { useState } from "react";

interface LogEntry {
  timestamp: string;
  level: string;
  stage: string;
  message: string;
  meta?: Record<string, unknown>;
}

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

interface Props {
  jobs: JobRun[];
  formatDuration: (ms: number | null) => string;
  sourceLabel: (s: string | null) => string;
  getListingsCount: (job: JobRun) => number;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  DISCOVER: "Discover Listings",
  PROCESS_QUEUE: "Process Queue",
  BUILD_INDEX: "Build Index",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} ${time}`;
}

export function JobRunsTable({ jobs, formatDuration, sourceLabel, getListingsCount }: Props) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [loadedLogs, setLoadedLogs] = useState<Record<string, LogEntry[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);

  const toggleLogs = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);

    // Only fetch if not already loaded
    if (loadedLogs[jobId]) return;

    setLoadingLogs(jobId);
    try {
      const res = await fetch(`/api/tools/rentals/job-runs/${jobId}/logs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLoadedLogs((prev) => ({ ...prev, [jobId]: data.logEntries ?? [] }));
    } catch {
      setLoadedLogs((prev) => ({ ...prev, [jobId]: [] }));
    } finally {
      setLoadingLogs(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <div style={styles.empty}>
        No job runs recorded yet. Click an action button above to start.
      </div>
    );
  }

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return "#f87171";
      case "warn": return "#fbbf24";
      case "debug": return "#64748b";
      default: return "#94a3b8";
    }
  };

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Timestamp</th>
            <th style={styles.th}>Job Type</th>
            <th style={styles.th}>Source</th>
            <th style={styles.th}>Status</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Listings</th>
            <th style={{ ...styles.th, textAlign: "right" }}>Duration</th>
            <th style={{ ...styles.th, textAlign: "center", width: "70px" }}>Logs</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <React.Fragment key={job.id}>
              <tr style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.timestamp}>
                    {formatTimestamp(job.startedAt)}
                  </span>
                </td>
                <td style={{ ...styles.td, fontWeight: 500, color: "#e2e8f0" }}>
                  {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
                </td>
                <td style={styles.td}>{sourceLabel(job.source)}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.pill,
                      ...(job.status === "SUCCESS" ? styles.pillSuccess : styles.pillFailed),
                    }}
                  >
                    {job.status === "SUCCESS" ? "Success" : "Failed"}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: "right", color: "#e2e8f0" }}>
                  {getListingsCount(job)}
                </td>
                <td style={{ ...styles.td, textAlign: "right", color: "#94a3b8" }}>
                  {formatDuration(job.durationMs)}
                </td>
                <td style={{ ...styles.td, textAlign: "center" }}>
                  <button
                    style={styles.logBtn}
                    onClick={() => toggleLogs(job.id)}
                    title="View logs for this job run"
                  >
                    {loadingLogs === job.id ? "…" : expandedJob === job.id ? "▾" : "▸"}
                  </button>
                </td>
              </tr>
              {expandedJob === job.id && (
                <tr>
                  <td colSpan={7} style={{ padding: 0, border: "none" }}>
                    <div style={styles.logPanel}>
                      {loadingLogs === job.id ? (
                        <div style={styles.logEmpty}>Loading logs…</div>
                      ) : (loadedLogs[job.id]?.length ?? 0) === 0 ? (
                        <div style={styles.logEmpty}>
                          No logs saved for this run.
                          <br />
                          <span style={{ fontSize: "11px", color: "#475569" }}>
                            Logs are saved for runs started after this update.
                          </span>
                        </div>
                      ) : (
                        <div style={styles.logScroll}>
                          {loadedLogs[job.id].map((entry, i) => (
                            <div key={i} style={styles.logLine}>
                              <span style={styles.logTime}>
                                {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                              </span>
                              <span style={{
                                ...styles.logLevel,
                                color: levelColor(entry.level),
                              }}>
                                {entry.level.toUpperCase().padEnd(5)}
                              </span>
                              <span style={styles.logStage}>[{entry.stage}]</span>
                              <span style={{
                                color: entry.level === "error" ? "#f87171"
                                  : entry.level === "warn" ? "#fbbf24"
                                  : entry.level === "debug" ? "#64748b"
                                  : "#cbd5e1",
                              }}>
                                {entry.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  tableWrap: {
    overflowX: "auto",
    borderRadius: "12px",
    border: "1px solid #1e293b",
    background: "rgba(15, 23, 42, 0.6)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #1e293b",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #1e293b",
    transition: "background 0.1s",
  },
  td: {
    padding: "12px 16px",
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },
  timestamp: {
    fontSize: "13px",
    color: "#cbd5e1",
  },
  pill: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.02em",
  },
  pillSuccess: {
    background: "rgba(16, 185, 129, 0.15)",
    color: "#6ee7b7",
    border: "1px solid rgba(16, 185, 129, 0.3)",
  },
  pillFailed: {
    background: "rgba(244, 63, 94, 0.15)",
    color: "#fda4af",
    border: "1px solid rgba(244, 63, 94, 0.3)",
  },
  empty: {
    padding: "40px 24px",
    textAlign: "center",
    color: "#64748b",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    fontSize: "14px",
  },
  logBtn: {
    background: "none",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "3px 10px",
    fontSize: "13px",
    transition: "all 0.15s",
  },
  logPanel: {
    background: "#0a0f1a",
    borderTop: "1px solid #1e293b",
    borderBottom: "1px solid #1e293b",
  },
  logScroll: {
    maxHeight: "300px",
    overflowY: "auto" as const,
    padding: "10px 16px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: "12px",
    lineHeight: "1.7",
  },
  logEmpty: {
    padding: "20px 16px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: "13px",
  },
  logLine: {
    display: "flex",
    gap: "8px",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  logTime: {
    color: "#475569",
    flexShrink: 0,
    fontSize: "11px",
  },
  logLevel: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 600,
    width: "42px",
  },
  logStage: {
    color: "#818cf8",
    flexShrink: 0,
    fontSize: "11px",
    marginRight: "4px",
  },
};
