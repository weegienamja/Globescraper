"use client";

import { useState, useEffect } from "react";

/* ── Types ──────────────────────────────────────────────── */

interface Subscriber {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  emailVerified: string | null;
  emailMarketingOptIn: boolean;
  emailUnsubscribed: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

interface Props {
  initialSubscribers: Subscriber[];
}

/* ── Helpers ────────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function subscriberStatus(s: Subscriber): { label: string; cls: string } {
  if (s.emailUnsubscribed) return { label: "Unsubscribed", cls: "admin__badge--danger" };
  if (s.emailMarketingOptIn) return { label: "Opted In", cls: "admin__badge--ok" };
  return { label: "Not Opted In", cls: "admin__badge--warn" };
}

/* ── Component ──────────────────────────────────────────── */

export function SubscriberTable({ initialSubscribers }: Props) {
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "opted-in" | "unsubscribed" | "verified">("all");
  const [toast, setToast] = useState<Toast | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = subscribers.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      s.email.toLowerCase().includes(q);

    let matchesFilter = true;
    if (filter === "opted-in") matchesFilter = s.emailMarketingOptIn && !s.emailUnsubscribed;
    if (filter === "unsubscribed") matchesFilter = s.emailUnsubscribed;
    if (filter === "verified") matchesFilter = !!s.emailVerified;

    return matchesSearch && matchesFilter;
  });

  async function toggleOptIn(userId: string, currentState: boolean) {
    try {
      const res = await fetch("/api/admin/email/subscribers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, emailMarketingOptIn: !currentState }),
      });
      if (res.ok) {
        setSubscribers((prev) =>
          prev.map((s) =>
            s.id === userId ? { ...s, emailMarketingOptIn: !currentState } : s,
          ),
        );
        setToast({ type: "success", message: `User ${!currentState ? "opted in" : "opted out"}.` });
      } else {
        setToast({ type: "error", message: "Update failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    }
  }

  async function toggleSuppress(userId: string, currentState: boolean) {
    try {
      const res = await fetch("/api/admin/email/subscribers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, emailUnsubscribed: !currentState }),
      });
      if (res.ok) {
        setSubscribers((prev) =>
          prev.map((s) =>
            s.id === userId ? { ...s, emailUnsubscribed: !currentState } : s,
          ),
        );
        setToast({ type: "success", message: `User ${!currentState ? "suppressed" : "unsuppressed"}.` });
      } else {
        setToast({ type: "error", message: "Update failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    }
  }

  return (
    <div className="em-subscribers">
      {toast && (
        <div className={`em-toast em-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button className="em-toast__close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Search and filter panel */}
      <div className="em-filter-bar">
        <div className="em-filter-bar__search">
          <input
            type="text"
            className="em-field__input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="em-filter-bar__filters">
          {(
            [
              { key: "all", label: "All" },
              { key: "opted-in", label: "Opted In" },
              { key: "unsubscribed", label: "Unsubscribed" },
              { key: "verified", label: "Verified" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              className={`em-filter-btn ${filter === f.key ? "em-filter-btn--active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="em-filter-bar__count">
          {filtered.length} of {subscribers.length} subscribers
        </div>
      </div>

      {/* Table */}
      <div className="em-panel">
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Signed Up</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const st = subscriberStatus(s);
                return (
                  <tr key={s.id}>
                    <td><strong>{s.name || "—"}</strong></td>
                    <td className="admin__sub-text">{s.email}</td>
                    <td>
                      <span className={`admin__badge ${s.role === "ADMIN" ? "admin__badge--new" : "admin__badge--user"}`}>
                        {s.role}
                      </span>
                    </td>
                    <td><span className={`admin__badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      {s.emailVerified ? (
                        <span className="admin__badge admin__badge--ok">Yes</span>
                      ) : (
                        <span className="admin__sub-text">No</span>
                      )}
                    </td>
                    <td className="admin__td-date">{fmtDate(s.createdAt)}</td>
                    <td className="admin__td-date">{s.lastActiveAt ? fmtDate(s.lastActiveAt) : "—"}</td>
                    <td>
                      {editingId === s.id ? (
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          <button
                            className="btn btn--outline btn--xs"
                            onClick={() => toggleOptIn(s.id, s.emailMarketingOptIn)}
                          >
                            {s.emailMarketingOptIn ? "Opt Out" : "Opt In"}
                          </button>
                          <button
                            className="btn btn--outline btn--xs"
                            onClick={() => toggleSuppress(s.id, s.emailUnsubscribed)}
                          >
                            {s.emailUnsubscribed ? "Unsuppress" : "Suppress"}
                          </button>
                          <button
                            className="btn btn--ghost btn--xs"
                            onClick={() => setEditingId(null)}
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn--ghost btn--xs"
                          onClick={() => setEditingId(s.id)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state__icon">👥</div>
                      <p className="empty-state__title">No subscribers found</p>
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
