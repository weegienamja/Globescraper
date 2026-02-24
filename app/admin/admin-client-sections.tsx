"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDisableUser, adminBanUser, adminReactivateUser } from "./admin-actions";

/* ── User Search & Management ─────────────────────────────── */

interface UserResult {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  disabled: boolean;
  deletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  profile: {
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    currentCountry: string | null;
    currentCity: string | null;
  } | null;
}

interface UserStats {
  connectionCount: number;
  messageCount: number;
  securityEvents: {
    id: string;
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }[];
}

export function AdminUserManagement() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({ name: "", email: "", bio: "", role: "", status: "" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function searchUsers(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(p));

      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function viewUser(user: UserResult) {
    setSelectedUser(user);
    setEditMode(false);
    setEditFields({
      name: user.name || "",
      email: user.email,
      bio: user.profile?.bio || "",
      role: user.role,
      status: user.status,
    });

    try {
      const res = await fetch(`/api/admin/users/${user.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setUserStats(data.stats);
      }
    } catch { /* ignore */ }
  }

  async function saveEdit() {
    if (!selectedUser) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          name: editFields.name || undefined,
          email: editFields.email || undefined,
          bio: editFields.bio || undefined,
          role: editFields.role || undefined,
          status: editFields.status || undefined,
        }),
      });
      if (res.ok) {
        setEditMode(false);
        searchUsers(page);
        const data = await res.json();
        if (data.user) {
          setSelectedUser({ ...selectedUser, ...data.user });
        }
      }
    });
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    if (!confirm(`Permanently delete ${selectedUser.email}? This soft-deletes the account.`)) return;

    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          anonymizeMessages: true,
        }),
      });
      if (res.ok) {
        setSelectedUser(null);
        searchUsers(page);
        router.refresh();
      }
    });
  }

  function handleBan() {
    if (!selectedUser) return;
    if (!confirm(`Ban ${selectedUser.email}? They will be unable to log in.`)) return;
    startTransition(async () => {
      await adminBanUser(selectedUser.id);
      searchUsers(page);
      router.refresh();
    });
  }

  function handleDisable() {
    if (!selectedUser) return;
    startTransition(async () => {
      await adminDisableUser(selectedUser.id);
      searchUsers(page);
      router.refresh();
    });
  }

  function handleReactivate() {
    if (!selectedUser) return;
    startTransition(async () => {
      await adminReactivateUser(selectedUser.id);
      searchUsers(page);
      router.refresh();
    });
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) : "—";

  const statusColor = (s: string) => {
    switch (s) {
      case "ACTIVE": return "admin__badge admin__badge--ok";
      case "SUSPENDED": return "admin__badge admin__badge--warn";
      case "BANNED": return "admin__badge admin__badge--danger";
      case "DELETED": return "admin__badge admin__badge--muted";
      default: return "admin__badge";
    }
  };

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">User Management</h2>

      {/* Search */}
      <div className="admin__search-row">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchUsers(1)}
          className="form__input form__input--sm"
          style={{ flex: 1 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form__input form__input--sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
          <option value="DELETED">Deleted</option>
        </select>
        <button onClick={() => searchUsers(1)} disabled={loading} className="btn btn--primary btn--sm">
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results */}
      {users.length > 0 && (
        <>
          <p className="admin__sub-text" style={{ marginBottom: 8 }}>
            {total} user{total !== 1 ? "s" : ""} found
          </p>
          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.profile?.displayName || u.name || "—"}</strong>
                      <br />
                      <span className="admin__sub-text">{u.email}</span>
                    </td>
                    <td><span className={u.role === "ADMIN" ? "admin__badge" : "admin__badge admin__badge--user"}>{u.role}</span></td>
                    <td><span className={statusColor(u.status)}>{u.status}</span></td>
                    <td className="admin__td-date">{fmtDate(u.createdAt)}</td>
                    <td>
                      <button onClick={() => viewUser(u)} className="btn btn--outline btn--sm">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="admin__pagination">
              <button onClick={() => searchUsers(page - 1)} disabled={page <= 1} className="btn btn--ghost btn--sm">← Prev</button>
              <span className="admin__sub-text">Page {page} of {pages}</span>
              <button onClick={() => searchUsers(page + 1)} disabled={page >= pages} className="btn btn--ghost btn--sm">Next →</button>
            </div>
          )}
        </>
      )}

      {/* User Detail Modal / Panel */}
      {selectedUser && (
        <div className="admin__modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin__modal-header">
              <h3>{selectedUser.profile?.displayName || selectedUser.name || selectedUser.email}</h3>
              <button onClick={() => setSelectedUser(null)} className="admin__modal-close">✕</button>
            </div>

            <div className="admin__modal-body">
              {editMode ? (
                <div className="admin__edit-form">
                  <label className="form__label">Name</label>
                  <input
                    type="text"
                    value={editFields.name}
                    onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                    className="form__input form__input--sm"
                  />
                  <label className="form__label">Email</label>
                  <input
                    type="email"
                    value={editFields.email}
                    onChange={(e) => setEditFields({ ...editFields, email: e.target.value })}
                    className="form__input form__input--sm"
                  />
                  <label className="form__label">Bio</label>
                  <textarea
                    value={editFields.bio}
                    onChange={(e) => setEditFields({ ...editFields, bio: e.target.value })}
                    className="form__input form__input--sm"
                    rows={3}
                  />
                  <label className="form__label">Role</label>
                  <select
                    value={editFields.role}
                    onChange={(e) => setEditFields({ ...editFields, role: e.target.value })}
                    className="form__input form__input--sm"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <label className="form__label">Status</label>
                  <select
                    value={editFields.status}
                    onChange={(e) => setEditFields({ ...editFields, status: e.target.value })}
                    className="form__input form__input--sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="BANNED">Banned</option>
                  </select>
                  <div className="admin__edit-actions">
                    <button onClick={saveEdit} disabled={pending} className="btn btn--primary btn--sm">
                      {pending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditMode(false)} className="btn btn--outline btn--sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="admin__detail-grid">
                    <div><strong>Email:</strong> {selectedUser.email}</div>
                    <div><strong>Role:</strong> <span className={selectedUser.role === "ADMIN" ? "admin__badge" : "admin__badge admin__badge--user"}>{selectedUser.role}</span></div>
                    <div><strong>Status:</strong> <span className={statusColor(selectedUser.status)}>{selectedUser.status}</span></div>
                    <div><strong>Created:</strong> {fmtDate(selectedUser.createdAt)}</div>
                    <div><strong>Last login:</strong> {fmtDate(selectedUser.lastLoginAt)}</div>
                    {selectedUser.profile && (
                      <>
                        <div><strong>Display name:</strong> {selectedUser.profile.displayName || "—"}</div>
                        <div><strong>Location:</strong> {[selectedUser.profile.currentCity, selectedUser.profile.currentCountry].filter(Boolean).join(", ") || "—"}</div>
                        <div><strong>Bio:</strong> {selectedUser.profile.bio || "—"}</div>
                      </>
                    )}
                  </div>

                  {/* Stats */}
                  {userStats && (
                    <div className="admin__stats-row">
                      <div className="admin__stat">
                        <span className="admin__stat-value">{userStats.connectionCount}</span>
                        <span className="admin__stat-label">Connections</span>
                      </div>
                      <div className="admin__stat">
                        <span className="admin__stat-value">{userStats.messageCount}</span>
                        <span className="admin__stat-label">Messages sent</span>
                      </div>
                    </div>
                  )}

                  {/* Security events */}
                  {userStats && userStats.securityEvents.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h4>Recent Security Events</h4>
                      <div className="admin__table-wrap" style={{ maxHeight: 200, overflow: "auto" }}>
                        <table className="admin__table admin__table--compact">
                          <thead>
                            <tr>
                              <th>Event</th>
                              <th>IP</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userStats.securityEvents.map((ev) => (
                              <tr key={ev.id}>
                                <td>{ev.eventType}</td>
                                <td className="admin__sub-text">{ev.ipAddress || "—"}</td>
                                <td className="admin__td-date">{fmtDate(ev.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="admin__modal-actions">
                    <button onClick={() => setEditMode(true)} className="btn btn--outline btn--sm">Edit</button>
                    {selectedUser.status === "ACTIVE" && (
                      <>
                        <button onClick={handleDisable} disabled={pending} className="btn btn--outline btn--sm">Suspend</button>
                        <button onClick={handleBan} disabled={pending} className="btn btn--danger btn--sm">Ban</button>
                      </>
                    )}
                    {(selectedUser.status === "SUSPENDED" || selectedUser.status === "BANNED") && (
                      <button onClick={handleReactivate} disabled={pending} className="btn btn--primary btn--sm">Reactivate</button>
                    )}
                    {selectedUser.status !== "DELETED" && (
                      <button onClick={handleDeleteUser} disabled={pending} className="btn btn--danger btn--sm">Delete</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Audit Log Viewer ────────────────────────────────────── */

interface AuditEntry {
  id: string;
  adminUserId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  targetUserId: string | null;
  metadata: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
  admin: { name: string | null; email: string };
}

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadEntries(p = 1) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-log?page=${p}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setPage(data.page);
        setPages(data.pages);
        setLoaded(true);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">Audit Log</h2>
      {!loaded ? (
        <button onClick={() => loadEntries(1)} disabled={loading} className="btn btn--outline btn--sm">
          {loading ? "Loading…" : "Load audit log"}
        </button>
      ) : (
        <>
          <div className="admin__table-wrap">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="admin__td-date">{fmtDate(e.createdAt)}</td>
                    <td>{e.admin.name || e.admin.email}</td>
                    <td><span className="admin__badge">{e.actionType}</span></td>
                    <td className="admin__sub-text">{e.targetType} / {e.targetId.substring(0, 8)}…</td>
                    <td className="admin__sub-text" style={{ maxWidth: 200 }}>
                      {e.metadata ? (
                        <details>
                          <summary>View</summary>
                          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{e.metadata}</pre>
                        </details>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin__sub-text" style={{ textAlign: "center", padding: 20 }}>
                      No audit log entries
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="admin__pagination">
              <button onClick={() => loadEntries(page - 1)} disabled={page <= 1 || loading} className="btn btn--ghost btn--sm">← Prev</button>
              <span className="admin__sub-text">Page {page} of {pages}</span>
              <button onClick={() => loadEntries(page + 1)} disabled={page >= pages || loading} className="btn btn--ghost btn--sm">Next →</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ── IP Blocking Management ──────────────────────────────── */

interface BlockedIpEntry {
  id: string;
  ipCidr: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export function AdminBlockedIps() {
  const [ips, setIps] = useState<BlockedIpEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [pending, startTransition] = useTransition();

  async function loadIps() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blocked-ips");
      if (res.ok) {
        const data = await res.json();
        setIps(data.ips);
        setLoaded(true);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  function addIp() {
    if (!newIp.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipCidr: newIp.trim(), reason: newReason.trim() || undefined }),
      });
      if (res.ok) {
        setNewIp("");
        setNewReason("");
        loadIps();
      }
    });
  }

  function removeIp(id: string) {
    startTransition(async () => {
      await fetch("/api/admin/blocked-ips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      loadIps();
    });
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">Blocked IPs</h2>
      {!loaded ? (
        <button onClick={loadIps} disabled={loading} className="btn btn--outline btn--sm">
          {loading ? "Loading…" : "Load blocked IPs"}
        </button>
      ) : (
        <>
          {/* Add new */}
          <div className="admin__search-row" style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="IP address or CIDR…"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              className="form__input form__input--sm"
            />
            <input
              type="text"
              placeholder="Reason (optional)…"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="form__input form__input--sm"
            />
            <button onClick={addIp} disabled={pending || !newIp.trim()} className="btn btn--danger btn--sm">
              Block IP
            </button>
          </div>

          {ips.length === 0 ? (
            <p className="admin__sub-text">No blocked IPs.</p>
          ) : (
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>IP / CIDR</th>
                    <th>Reason</th>
                    <th>Blocked</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ips.map((ip) => (
                    <tr key={ip.id}>
                      <td><code>{ip.ipCidr}</code></td>
                      <td className="admin__sub-text">{ip.reason || "—"}</td>
                      <td className="admin__td-date">{fmtDate(ip.createdAt)}</td>
                      <td className="admin__sub-text">{ip.expiresAt ? fmtDate(ip.expiresAt) : "Never"}</td>
                      <td>
                        <button onClick={() => removeIp(ip.id)} disabled={pending} className="btn btn--ghost btn--sm">
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
