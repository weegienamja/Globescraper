"use client";

import React from "react";

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
  if (jobs.length === 0) {
    return (
      <div style={styles.empty}>
        No job runs recorded yet. Click an action button above to start.
      </div>
    );
  }

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
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={styles.tr}>
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
            </tr>
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
};
