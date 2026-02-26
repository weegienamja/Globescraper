"use client";

import { useState, useEffect, useMemo } from "react";

/* ── Types ──────────────────────────────────────────────── */

interface EmailLogRow {
  id: string;
  subject: string | null;
  type: string;
  status: string;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

interface CampaignRow {
  id: string;
  subject: string;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  bounceCount: number;
  createdAt: string;
}

interface DailyStat {
  date: string; // "YYYY-MM-DD"
  sent: number;
  opened: number;
  bounced: number;
}

interface Props {
  logs: EmailLogRow[];
  campaigns: CampaignRow[];
  dailyStats: DailyStat[];
}

interface Toast {
  type: "success" | "error";
  message: string;
}

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return (numerator / denominator * 100).toFixed(1) + "%";
}

/* ── Component ──────────────────────────────────────────── */

export function AnalyticsDashboard({ logs, campaigns, dailyStats }: Props) {
  const [tab, setTab] = useState<"overview" | "logs">("overview");
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Aggregate from logs ── */
  const agg = useMemo(() => {
    const totalSent = logs.filter((l) => l.status === "SENT").length;
    const totalOpened = logs.filter((l) => l.openedAt).length;
    const totalClicked = logs.filter((l) => l.clickedAt).length;
    const totalBounced = logs.filter((l) => l.status === "BOUNCED").length;
    const totalFailed = logs.filter((l) => l.status === "FAILED").length;
    const marketing = logs.filter((l) => l.type === "MARKETING").length;
    const transactional = logs.filter((l) => l.type === "TRANSACTIONAL").length;
    return { totalSent, totalOpened, totalClicked, totalBounced, totalFailed, marketing, transactional };
  }, [logs]);

  /* ── Chart data: max bar = 100% width, scale to max day ── */
  const maxDaily = useMemo(
    () => Math.max(...dailyStats.map((d) => d.sent), 1),
    [dailyStats],
  );

  /* ── Top campaigns ── */
  const topCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.openCount - a.openCount).slice(0, 5),
    [campaigns],
  );

  return (
    <div className="em-analytics">
      {toast && (
        <div className={`em-toast em-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button className="em-toast__close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="em-subtabs">
        <button
          className={`em-subtab ${tab === "overview" ? "em-subtab--active" : ""}`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={`em-subtab ${tab === "logs" ? "em-subtab--active" : ""}`}
          onClick={() => setTab("logs")}
        >
          Email Logs
        </button>
      </div>

      {tab === "overview" && (
        <>
          {/* KPI cards */}
          <div className="em-analytics__kpis">
            {[
              { label: "Total Sent", value: agg.totalSent, icon: "📤" },
              { label: "Open Rate", value: pct(agg.totalOpened, agg.totalSent), icon: "📬" },
              { label: "Click Rate", value: pct(agg.totalClicked, agg.totalSent), icon: "🔗" },
              { label: "Bounce Rate", value: pct(agg.totalBounced, agg.totalSent), icon: "⛔" },
              { label: "Failed", value: agg.totalFailed, icon: "❌" },
              { label: "Marketing", value: agg.marketing, icon: "📣" },
            ].map((k) => (
              <div key={k.label} className="em-analytics__kpi">
                <div className="em-analytics__kpi-icon">{k.icon}</div>
                <div className="em-analytics__kpi-value">{k.value}</div>
                <div className="em-analytics__kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Bar chart – Daily volume */}
          <div className="em-panel" style={{ marginTop: "1.5rem" }}>
            <div className="em-panel__header">
              <h4 className="em-panel__title">Daily Email Volume (Last 14 Days)</h4>
            </div>
            <div className="em-chart">
              {dailyStats.map((d) => (
                <div key={d.date} className="em-chart__row">
                  <div className="em-chart__label">
                    {new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </div>
                  <div className="em-chart__bars">
                    <div className="em-chart__bar em-chart__bar--sent" style={{ width: `${(d.sent / maxDaily) * 100}%` }}>
                      {d.sent > 0 && <span>{d.sent}</span>}
                    </div>
                    <div className="em-chart__bar em-chart__bar--opened" style={{ width: `${(d.opened / maxDaily) * 100}%` }}>
                      {d.opened > 0 && <span>{d.opened}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {dailyStats.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state__icon">📊</div>
                  <p className="empty-state__title">No data yet</p>
                </div>
              )}
            </div>
            <div className="em-chart__legend">
              <span className="em-chart__legend-item"><span className="em-chart__dot em-chart__dot--sent" /> Sent</span>
              <span className="em-chart__legend-item"><span className="em-chart__dot em-chart__dot--opened" /> Opened</span>
            </div>
          </div>

          {/* Top campaigns */}
          <div className="em-panel" style={{ marginTop: "1.5rem" }}>
            <div className="em-panel__header">
              <h4 className="em-panel__title">Top Campaigns by Opens</h4>
            </div>
            {topCampaigns.length > 0 ? (
              <div className="admin__table-wrap">
                <table className="admin__table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Sent</th>
                      <th>Delivered</th>
                      <th>Opened</th>
                      <th>Open Rate</th>
                      <th>Bounced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.subject}</strong></td>
                        <td>{c.sentCount}</td>
                        <td>{c.deliveredCount}</td>
                        <td>{c.openCount}</td>
                        <td>{pct(c.openCount, c.deliveredCount || c.sentCount)}</td>
                        <td>{c.bounceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">📧</div>
                <p className="empty-state__title">No campaigns yet</p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "logs" && (
        <div className="em-panel" style={{ marginTop: "0.5rem" }}>
          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 100).map((l) => (
                  <tr key={l.id}>
                    <td className="admin__td-date">{fmtDate(l.createdAt)}</td>
                    <td>{l.subject || "—"}</td>
                    <td>
                      <span className={`admin__badge ${l.type === "MARKETING" ? "admin__badge--new" : "admin__badge--muted"}`}>
                        {l.type}
                      </span>
                    </td>
                    <td>
                      <span className={`admin__badge ${
                        l.status === "SENT"
                          ? "admin__badge--ok"
                          : l.status === "BOUNCED"
                            ? "admin__badge--danger"
                            : l.status === "FAILED"
                              ? "admin__badge--danger"
                              : "admin__badge--warn"
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td>{l.openedAt ? fmtDate(l.openedAt) : "—"}</td>
                    <td>{l.clickedAt ? fmtDate(l.clickedAt) : "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state__icon">📋</div>
                        <p className="empty-state__title">No email logs yet</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {logs.length > 100 && (
            <p className="admin__sub-text" style={{ padding: "1rem", textAlign: "center" }}>
              Showing 100 of {logs.length} logs
            </p>
          )}
        </div>
      )}
    </div>
  );
}
