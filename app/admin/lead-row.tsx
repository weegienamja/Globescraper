"use client";

import { useState } from "react";
import type { LeadStatus } from "@prisma/client";

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"];

const STATUS_CLASSES: Record<LeadStatus, string> = {
  NEW: "admin__badge admin__badge--new",
  CONTACTED: "admin__badge admin__badge--contacted",
  CONVERTED: "admin__badge admin__badge--ok",
  CLOSED: "admin__badge admin__badge--warn",
};

interface LeadRowProps {
  lead: {
    id: string;
    createdAt: Date;
    name: string | null;
    email: string;
    source: string | null;
    status: LeadStatus;
    adminNotes: string | null;
  };
}

export function LeadRow({ lead }: LeadRowProps) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.adminNotes ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  async function updateField(field: "status" | "adminNotes", value: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, [field]: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update lead.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function handleStatusChange(newStatus: LeadStatus) {
    setStatus(newStatus);
    updateField("status", newStatus);
  }

  function handleNotesSave() {
    setEditing(false);
    updateField("adminNotes", notes);
  }

  return (
    <tr>
      <td className="admin__td-date">{fmtDate(lead.createdAt)}</td>
      <td>
        <strong>{lead.name || "—"}</strong>
        <br />
        <span className="admin__sub-text">{lead.email}</span>
      </td>
      <td className="admin__sub-text">{lead.source || "—"}</td>
      <td>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          disabled={saving}
          className={`admin__status-select ${STATUS_CLASSES[status]}`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>
      <td>
        {editing ? (
          <div className="admin__notes-edit">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="admin__notes-textarea"
            />
            <div className="admin__notes-actions">
              <button onClick={handleNotesSave} disabled={saving} className="admin__btn-sm">
                Save
              </button>
              <button onClick={() => { setEditing(false); setNotes(lead.adminNotes ?? ""); }} className="admin__btn-sm admin__btn-sm--ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="admin__notes-display" onClick={() => setEditing(true)} title="Click to edit">
            {notes || <span className="admin__sub-text">Click to add notes…</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
