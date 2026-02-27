"use client";

import { useRef, useEffect } from "react";

/* ── Types ───────────────────────────────────────────────── */

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  stage: string;
  message: string;
  meta?: Record<string, unknown>;
}

interface LiveLogViewerProps {
  logs: LogEntry[];
  isConnected: boolean;
  onClear?: () => void;
}

/* ── Component ───────────────────────────────────────────── */

export function LiveLogViewer({ logs, isConnected, onClear }: LiveLogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const levelColor = (level: string) => {
    switch (level) {
      case "info":
        return "#4ade80";
      case "warn":
        return "#fbbf24";
      case "error":
        return "#f87171";
      case "debug":
        return "#64748b";
      default:
        return "#94a3b8";
    }
  };

  const levelIcon = (level: string) => {
    switch (level) {
      case "info":
        return "●";
      case "warn":
        return "▲";
      case "error":
        return "✗";
      case "debug":
        return "○";
      default:
        return "·";
    }
  };

  const stageColor = (stage: string) => {
    switch (stage) {
      case "discover":
        return "#818cf8";
      case "process":
        return "#22d3ee";
      case "index":
        return "#a78bfa";
      case "system":
        return "#94a3b8";
      default:
        return "#94a3b8";
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatMeta = (meta?: Record<string, unknown>) => {
    if (!meta || Object.keys(meta).length === 0) return null;
    return Object.entries(meta)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
  };

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div
            style={{
              ...s.dot,
              background: isConnected ? "#4ade80" : "#64748b",
              boxShadow: isConnected ? "0 0 8px rgba(74,222,128,0.6)" : "none",
            }}
          />
          <span style={s.title}>Pipeline Logs</span>
          <span style={s.badge}>{logs.length}</span>
        </div>
        <div style={s.headerRight}>
          {isConnected && (
            <span style={s.liveTag}>
              <span style={s.liveDot} />
              LIVE
            </span>
          )}
          {onClear && logs.length > 0 && (
            <button style={s.clearBtn} onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Log area */}
      <div style={s.logArea} ref={scrollRef}>
        {logs.length === 0 ? (
          <div style={s.empty}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Logs will appear here when you run a pipeline job...</span>
          </div>
        ) : (
          logs.map((entry, i) => {
            const isSystem = entry.stage === "system";
            const meta = formatMeta(entry.meta);

            return (
              <div
                key={i}
                style={{
                  ...s.line,
                  ...(isSystem ? s.systemLine : {}),
                  ...(entry.level === "error" ? s.errorLine : {}),
                }}
              >
                <span style={s.ts}>{formatTime(entry.timestamp)}</span>
                <span style={{ ...s.levelIcon, color: levelColor(entry.level) }}>
                  {levelIcon(entry.level)}
                </span>
                {!isSystem && (
                  <span style={{ ...s.stage, color: stageColor(entry.stage) }}>
                    [{entry.stage}]
                  </span>
                )}
                <span
                  style={{
                    ...s.msg,
                    ...(isSystem ? s.systemMsg : {}),
                    ...(entry.level === "error" ? { color: "#fca5a5" } : {}),
                    ...(entry.level === "warn" ? { color: "#fde68a" } : {}),
                  }}
                >
                  {entry.message}
                </span>
                {meta && <span style={s.meta}>{meta}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    marginTop: "24px",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#0a0f1a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "rgba(15, 23, 42, 0.8)",
    borderBottom: "1px solid #1e293b",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    transition: "all 0.3s",
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#e2e8f0",
    fontFamily: "monospace",
  },
  badge: {
    fontSize: "11px",
    color: "#94a3b8",
    background: "#1e293b",
    padding: "2px 8px",
    borderRadius: "10px",
    fontFamily: "monospace",
  },
  liveTag: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#4ade80",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    fontFamily: "monospace",
  },
  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#4ade80",
    animation: "pulse-log 1.5s ease-in-out infinite",
  },
  clearBtn: {
    padding: "4px 12px",
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#94a3b8",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "monospace",
  },
  logArea: {
    maxHeight: "400px",
    overflowY: "auto" as const,
    padding: "8px 0",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: "12.5px",
    lineHeight: "1.7",
  },
  empty: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "center",
    padding: "40px 20px",
    color: "#475569",
    fontSize: "13px",
    fontFamily: "monospace",
  },
  line: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    padding: "1px 16px",
    transition: "background 0.1s",
  },
  systemLine: {
    padding: "6px 16px",
    background: "rgba(30, 41, 59, 0.4)",
    borderTop: "1px solid rgba(51, 65, 85, 0.3)",
    borderBottom: "1px solid rgba(51, 65, 85, 0.3)",
    marginTop: "4px",
    marginBottom: "4px",
  },
  errorLine: {
    background: "rgba(127, 29, 29, 0.15)",
  },
  ts: {
    color: "#475569",
    flexShrink: 0,
    minWidth: "65px",
    fontSize: "11.5px",
  },
  levelIcon: {
    flexShrink: 0,
    width: "12px",
    textAlign: "center" as const,
    fontSize: "10px",
  },
  stage: {
    flexShrink: 0,
    fontSize: "11.5px",
    fontWeight: 500,
    minWidth: "72px",
  },
  msg: {
    color: "#cbd5e1",
    wordBreak: "break-word" as const,
  },
  systemMsg: {
    color: "#94a3b8",
    fontWeight: 600,
    fontSize: "12px",
  },
  meta: {
    color: "#475569",
    fontSize: "11px",
    marginLeft: "4px",
    flexShrink: 0,
  },
};
