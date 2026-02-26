"use client";

import { useState, useEffect } from "react";

/* ── Types ──────────────────────────────────────────────── */

interface Suppressed {
  id: string;
  email: string;
  name: string | null;
  reason: "unsubscribed" | "bounced" | "complaint" | "manual";
  date: string; // ISO string
}

interface Toast {
  type: "success" | "error";
  message: string;
}

interface Props {
  initialList: Suppressed[];
}

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const REASON_LABELS: Record<string, { label: string; cls: string }> = {
  unsubscribed: { label: "Unsubscribed", cls: "admin__badge--warn" },
  bounced: { label: "Bounced", cls: "admin__badge--danger" },
  complaint: { label: "Complaint", cls: "admin__badge--danger" },
  manual: { label: "Manual", cls: "admin__badge--muted" },
};

/* ── Component ──────────────────────────────────────────── */

export function SuppressionList({ initialList }: Props) {
  const [list, setList] = useState(initialList);
  const [search, setSearch] = useState("");
  const [filterReason, setFilterReason] = useState<"all" | "unsubscribed" | "bounced" | "complaint" | "manual">("all");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = list.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.email.toLowerCase().includes(q) ||
      (s.name && s.name.toLowerCase().includes(q));
    const matchesFilter = filterReason === "all" || s.reason === filterReason;
    return matchesSearch && matchesFilter;
  });

  async function removeSuppression(id: string) {
    try {
      const res = await fetch("/api/admin/email/subscribers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, emailUnsubscribed: false }),
      });
      if (res.ok) {
        setList((prev) => prev.filter((s) => s.id !== id));
        setToast({ type: "success", message: "Removed from suppression list." });
      } else {
        setToast({ type: "error", message: "Failed to remove." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    }
    setConfirmId(null);
  }

  const counts = {
    all: list.length,
    unsubscribed: list.filter((s) => s.reason === "unsubscribed").length,
    bounced: list.filter((s) => s.reason === "bounced").length,
    complaint: list.filter((s) => s.reason === "complaint").length,
    manual: list.filter((s) => s.reason === "manual").length,
  };

  return (
    <div className="em-suppression">
      {toast && (
        <div className={`em-toast em-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button className="em-toast__close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Reason summary badges */}
      <div className="em-suppression__summary">
        {(["all", "unsubscribed", "bounced", "complaint", "manual"] as const).map((r) => (
          <button
            key={r}
            className={`em-filter-btn ${filterReason === r ? "em-filter-btn--active" : ""}`}
            onClick={() => setFilterReason(r)}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}{" "}
            <span className="em-filter-btn__count">{counts[r]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="em-filter-bar" style={{ marginBottom: "1rem" }}>
        <div className="em-filter-bar__search">
          <input
            type="text"
            className="em-field__input"
            placeholder="Search suppressed emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="em-filter-bar__count">
          {filtered.length} of {list.length} suppressed
        </div>
      </div>

      {/* Table */}
      <div className="em-panel">
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Reason</th>
                <th>Date Suppressed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const reason = REASON_LABELS[s.reason] ?? { label: s.reason, cls: "admin__badge--muted" };
                return (
                  <tr key={s.id}>
                    <td><strong>{s.email}</strong></td>
                    <td className="admin__sub-text">{s.name || "—"}</td>
                    <td><span className={`admin__badge ${reason.cls}`}>{reason.label}</span></td>
                    <td className="admin__td-date">{fmtDate(s.date)}</td>
                    <td>
                      {confirmId === s.id ? (
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          <button
                            className="btn btn--primary btn--xs"
                            onClick={() => removeSuppression(s.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn--ghost btn--xs"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn--outline btn--xs"
                          onClick={() => setConfirmId(s.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-state__icon">🚫</div>
                      <p className="empty-state__title">No suppressed emails found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
