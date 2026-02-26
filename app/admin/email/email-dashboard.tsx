"use client";

import { useState } from "react";

/* ── Types ────────────────────────────────────────────────── */

interface Campaign {
  id: string;
  subject: string;
  previewText: string | null;
  htmlContent: string;
  textContent: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  bounceCount: number;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  optedIn: number;
  unsubscribed: number;
  verified: number;
  eligible: number;
}

interface LogEntry {
  id: string;
  type: string;
  subject: string;
  status: string;
  createdAt: string;
  openedAt: string | null;
  clickedAt: string | null;
  error: string | null;
  user: { email: string; name: string | null };
  campaign: { subject: string } | null;
}

interface SuppressedUser {
  id: string;
  email: string;
  name: string | null;
  updatedAt: string;
}

interface UserEntry {
  id: string;
  email: string;
  name: string | null;
  emailMarketingOptIn: boolean;
  emailUnsubscribed: boolean;
}

type Tab = "single" | "campaigns" | "subscribers" | "suppression";

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "admin__badge--warn",
    SCHEDULED: "admin__badge--new",
    SENDING: "admin__badge--contacted",
    SENT: "admin__badge--ok",
    PENDING: "admin__badge--warn",
    FAILED: "admin__badge--danger",
    BOUNCED: "admin__badge--danger",
  };
  return `admin__badge ${map[status] || ""}`;
}

/* ── Main Component ───────────────────────────────────────── */

export function AdminEmailDashboard({
  initialCampaigns,
  initialStats,
  initialLogs,
  initialSuppressed,
  initialUsers,
}: {
  initialCampaigns: Campaign[];
  initialStats: Stats;
  initialLogs: LogEntry[];
  initialSuppressed: SuppressedUser[];
  initialUsers: UserEntry[];
}) {
  const [tab, setTab] = useState<Tab>("single");

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "single", label: "Single Email", icon: "✉️" },
    { key: "campaigns", label: "Campaigns", icon: "📨" },
    { key: "subscribers", label: "Subscribers", icon: "👥" },
    { key: "suppression", label: "Suppression List", icon: "🚫" },
  ];

  return (
    <>
      {/* Stats cards */}
      <div className="admin__metrics">
        <div className="admin__card">
          <div className="admin__card-value">{initialStats.totalUsers}</div>
          <div className="admin__card-label">Total Active Users</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{initialStats.optedIn}</div>
          <div className="admin__card-label">Opted In</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{initialStats.eligible}</div>
          <div className="admin__card-label">Eligible Recipients</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{initialStats.unsubscribed}</div>
          <div className="admin__card-label">Unsubscribed</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{initialStats.verified}</div>
          <div className="admin__card-label">Email Verified</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="email-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`email-tabs__btn ${tab === t.key ? "email-tabs__btn--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="email-tabs__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="email-panel">
        {tab === "single" && <SingleEmailTab users={initialUsers} />}
        {tab === "campaigns" && <CampaignsTab campaigns={initialCampaigns} />}
        {tab === "subscribers" && <SubscribersTab logs={initialLogs} stats={initialStats} />}
        {tab === "suppression" && <SuppressionTab suppressed={initialSuppressed} />}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: Single Email
   ══════════════════════════════════════════════════════════ */

function SingleEmailTab({ users }: { users: UserEntry[] }) {
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handleSend() {
    if (!userId || !subject || !htmlContent) {
      setResult({ error: "Please fill in all required fields." });
      return;
    }
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/email/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, subject, htmlContent, textContent }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true });
        setSubject("");
        setHtmlContent("");
        setTextContent("");
      } else {
        setResult({ error: data.error || "Failed to send." });
      }
    } catch {
      setResult({ error: "Network error." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="email-form">
      <h3 className="email-form__title">Send Single Email</h3>

      <label className="email-form__label">
        Recipient
        <select
          className="email-form__select"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">Select a user...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || "No name"} ({u.email})
              {u.emailUnsubscribed ? " [Unsubscribed]" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="email-form__label">
        Subject *
        <input
          type="text"
          className="email-form__input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line"
          maxLength={200}
        />
      </label>

      <label className="email-form__label">
        HTML Content *
        <textarea
          className="email-form__textarea"
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          placeholder="<h1>Hello!</h1><p>Your message here...</p>"
          rows={10}
        />
      </label>

      <label className="email-form__label">
        Plain Text (optional)
        <textarea
          className="email-form__textarea"
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="Plain text version of the email"
          rows={4}
        />
      </label>

      {result && (
        <div className={`email-form__alert ${result.ok ? "email-form__alert--ok" : "email-form__alert--err"}`}>
          {result.ok ? "Email sent successfully." : result.error}
        </div>
      )}

      <button
        className="btn btn--primary"
        onClick={handleSend}
        disabled={sending}
      >
        {sending ? "Sending..." : "Send Email"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: Campaigns
   ══════════════════════════════════════════════════════════ */

function CampaignsTab({ campaigns: initialCampaigns }: { campaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showCreate, setShowCreate] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ ok?: boolean; error?: string; msg?: string } | null>(null);

  // Campaign form state
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  // AI generation state
  const [aiObjective, setAiObjective] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiTone, setAiTone] = useState("Friendly and professional");
  const [aiCta, setAiCta] = useState("");
  const [aiLength, setAiLength] = useState("Medium (2-3 short paragraphs)");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handleAiGenerate() {
    if (!aiObjective) {
      setAiResult({ error: "Please provide an objective." });
      return;
    }
    setAiGenerating(true);
    setAiResult(null);

    try {
      const res = await fetch("/api/admin/email/generate-with-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: aiObjective,
          audienceSegment: aiAudience,
          tone: aiTone,
          callToAction: aiCta,
          lengthPreference: aiLength,
        }),
      });
      const data = await res.json();
      if (res.ok && data.generated) {
        setSubject(data.generated.subject || "");
        setPreviewText(data.generated.previewText || "");
        setHtmlContent(data.generated.htmlContent || "");
        setTextContent(data.generated.textContent || "");
        setAiResult({ ok: true });
        setShowAi(false);
        setShowCreate(true);
      } else {
        setAiResult({ error: data.error || "AI generation failed." });
      }
    } catch {
      setAiResult({ error: "Network error." });
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleSaveCampaign() {
    if (!subject || !htmlContent) {
      setSendResult({ error: "Subject and HTML content are required." });
      return;
    }
    setSaving(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          previewText,
          htmlContent,
          textContent,
          scheduledAt: scheduledAt || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.campaign) {
        setCampaigns([data.campaign, ...campaigns]);
        setShowCreate(false);
        setSubject("");
        setPreviewText("");
        setHtmlContent("");
        setTextContent("");
        setScheduledAt("");
        setSendResult({ ok: true, msg: "Campaign saved as draft." });
      } else {
        setSendResult({ error: data.error || "Failed to save." });
      }
    } catch {
      setSendResult({ error: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendCampaign(campaignId: string) {
    if (!confirm("Are you sure you want to send this campaign to all eligible subscribers? This cannot be undone.")) {
      return;
    }
    setSendingId(campaignId);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/email/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ ok: true, msg: `Campaign sent to ${data.sentCount} recipients.${data.failCount ? ` ${data.failCount} failed.` : ""}` });
        // Update local state
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaignId ? { ...c, status: "SENT", sentCount: data.sentCount } : c,
          ),
        );
      } else {
        setSendResult({ error: data.error || "Send failed." });
      }
    } catch {
      setSendResult({ error: "Network error." });
    } finally {
      setSendingId(null);
    }
  }

  async function handleDeleteCampaign(campaignId: string) {
    if (!confirm("Delete this campaign draft?")) return;

    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      }
    } catch {
      // Ignore
    }
  }

  return (
    <div>
      <div className="email-form__row" style={{ marginBottom: "1rem" }}>
        <button className="btn btn--primary btn--sm" onClick={() => { setShowCreate(true); setShowAi(false); }}>
          + New Campaign
        </button>
        <button className="btn btn--outline btn--sm" onClick={() => { setShowAi(true); setShowCreate(false); }}>
          Generate with AI
        </button>
      </div>

      {sendResult && (
        <div className={`email-form__alert ${sendResult.ok ? "email-form__alert--ok" : "email-form__alert--err"}`}>
          {sendResult.ok ? sendResult.msg : sendResult.error}
        </div>
      )}

      {/* AI Generation Form */}
      {showAi && (
        <div className="email-form" style={{ marginBottom: "1.5rem" }}>
          <h3 className="email-form__title">Generate Email with AI</h3>
          <p className="email-form__hint">AI will generate content for you to review. Nothing is sent or saved automatically.</p>

          <label className="email-form__label">
            Objective *
            <input
              type="text"
              className="email-form__input"
              value={aiObjective}
              onChange={(e) => setAiObjective(e.target.value)}
              placeholder="e.g. Welcome new teachers to the platform"
            />
          </label>

          <label className="email-form__label">
            Audience Segment
            <input
              type="text"
              className="email-form__input"
              value={aiAudience}
              onChange={(e) => setAiAudience(e.target.value)}
              placeholder="e.g. South African teachers, new users"
            />
          </label>

          <div className="email-form__row">
            <label className="email-form__label" style={{ flex: 1 }}>
              Tone
              <select className="email-form__select" value={aiTone} onChange={(e) => setAiTone(e.target.value)}>
                <option>Friendly and professional</option>
                <option>Casual and warm</option>
                <option>Informational</option>
                <option>Exciting and energetic</option>
              </select>
            </label>

            <label className="email-form__label" style={{ flex: 1 }}>
              Length
              <select className="email-form__select" value={aiLength} onChange={(e) => setAiLength(e.target.value)}>
                <option>Short (1-2 paragraphs)</option>
                <option>Medium (2-3 short paragraphs)</option>
                <option>Longer (3-4 paragraphs)</option>
              </select>
            </label>
          </div>

          <label className="email-form__label">
            Call to Action
            <input
              type="text"
              className="email-form__input"
              value={aiCta}
              onChange={(e) => setAiCta(e.target.value)}
              placeholder="e.g. Complete your profile, Browse the community"
            />
          </label>

          {aiResult && (
            <div className={`email-form__alert ${aiResult.ok ? "email-form__alert--ok" : "email-form__alert--err"}`}>
              {aiResult.ok ? "Content generated. Review in the campaign form below." : aiResult.error}
            </div>
          )}

          <div className="email-form__row">
            <button
              className="btn btn--primary"
              onClick={handleAiGenerate}
              disabled={aiGenerating}
            >
              {aiGenerating ? "Generating..." : "Generate Content"}
            </button>
            <button className="btn btn--outline" onClick={() => setShowAi(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Campaign Form */}
      {showCreate && (
        <div className="email-form" style={{ marginBottom: "1.5rem" }}>
          <h3 className="email-form__title">Create Campaign</h3>

          <label className="email-form__label">
            Subject *
            <input
              type="text"
              className="email-form__input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              maxLength={200}
            />
          </label>

          <label className="email-form__label">
            Preview Text
            <input
              type="text"
              className="email-form__input"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Short preview text shown in inbox"
              maxLength={200}
            />
          </label>

          <label className="email-form__label">
            HTML Content *
            <textarea
              className="email-form__textarea"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
              rows={12}
            />
          </label>

          <label className="email-form__label">
            Plain Text (optional)
            <textarea
              className="email-form__textarea"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
            />
          </label>

          <label className="email-form__label">
            Schedule (optional)
            <input
              type="datetime-local"
              className="email-form__input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>

          {htmlContent && (
            <details className="email-form__preview-toggle">
              <summary>Preview HTML</summary>
              <div
                className="email-form__preview"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </details>
          )}

          <div className="email-form__row">
            <button
              className="btn btn--primary"
              onClick={handleSaveCampaign}
              disabled={saving}
            >
              {saving ? "Saving..." : scheduledAt ? "Save & Schedule" : "Save as Draft"}
            </button>
            <button className="btn btn--outline" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Opens</th>
              <th>Bounces</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="admin__td-date">{fmtDate(c.createdAt)}</td>
                <td>
                  <strong>{c.subject}</strong>
                  {c.previewText && (
                    <>
                      <br />
                      <span className="admin__sub-text">{c.previewText}</span>
                    </>
                  )}
                </td>
                <td>
                  <span className={statusBadge(c.status)}>{c.status}</span>
                  {c.scheduledAt && c.status === "SCHEDULED" && (
                    <div className="admin__sub-text" style={{ marginTop: 4 }}>
                      {fmtDate(c.scheduledAt)}
                    </div>
                  )}
                </td>
                <td>{c.sentCount}</td>
                <td>{c.openCount}</td>
                <td>{c.bounceCount}</td>
                <td>
                  <div className="email-form__row" style={{ gap: "0.5rem" }}>
                    {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                      <>
                        <button
                          className="btn btn--primary btn--xs"
                          onClick={() => handleSendCampaign(c.id)}
                          disabled={sendingId === c.id}
                        >
                          {sendingId === c.id ? "Sending..." : "Send Now"}
                        </button>
                        <button
                          className="btn btn--outline btn--xs btn--danger"
                          onClick={() => handleDeleteCampaign(c.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {c.status === "SENT" && (
                      <span className="admin__sub-text">
                        Sent {c.sentAt ? fmtDate(c.sentAt) : ""}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state__icon">📨</div>
                    <p className="empty-state__title">No campaigns yet</p>
                    <p className="empty-state__text">Create your first email campaign above.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: Subscribers / Email Logs
   ══════════════════════════════════════════════════════════ */

function SubscribersTab({ logs, stats }: { logs: LogEntry[]; stats: Stats }) {
  return (
    <div>
      <div className="admin__metrics" style={{ marginBottom: "1.5rem" }}>
        <div className="admin__card">
          <div className="admin__card-value">{stats.eligible}</div>
          <div className="admin__card-label">Eligible to Receive</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{stats.optedIn}</div>
          <div className="admin__card-label">Marketing Opt-in</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{stats.verified}</div>
          <div className="admin__card-label">Email Verified</div>
        </div>
        <div className="admin__card">
          <div className="admin__card-value">{stats.unsubscribed}</div>
          <div className="admin__card-label">Unsubscribed</div>
        </div>
      </div>

      <h3 className="admin__section-title">Recent Email Activity</h3>
      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Status</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="admin__td-date">{fmtDate(log.createdAt)}</td>
                <td>
                  <strong>{log.user.name || "Unknown"}</strong>
                  <br />
                  <span className="admin__sub-text">{log.user.email}</span>
                </td>
                <td>{log.subject}</td>
                <td>
                  <span className={`admin__badge ${log.type === "MARKETING" ? "admin__badge--new" : "admin__badge--user"}`}>
                    {log.type}
                  </span>
                </td>
                <td>
                  <span className={statusBadge(log.status)}>{log.status}</span>
                  {log.error && (
                    <div className="admin__sub-text" style={{ color: "#ef4444", marginTop: 2 }}>
                      {log.error}
                    </div>
                  )}
                </td>
                <td>
                  {log.openedAt ? (
                    <span className="admin__badge admin__badge--ok">Yes</span>
                  ) : (
                    <span className="admin__sub-text">No</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state__icon">📋</div>
                    <p className="empty-state__title">No email activity yet</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: Suppression List
   ══════════════════════════════════════════════════════════ */

function SuppressionTab({ suppressed }: { suppressed: SuppressedUser[] }) {
  return (
    <div>
      <p className="email-form__hint" style={{ marginBottom: "1rem" }}>
        Users who have unsubscribed from marketing emails. They will not receive campaigns but can still receive transactional emails.
      </p>
      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Unsubscribed At</th>
            </tr>
          </thead>
          <tbody>
            {suppressed.map((u) => (
              <tr key={u.id}>
                <td>{u.name || "Unknown"}</td>
                <td>{u.email}</td>
                <td className="admin__td-date">{fmtDate(u.updatedAt)}</td>
              </tr>
            ))}
            {suppressed.length === 0 && (
              <tr>
                <td colSpan={3}>
                  <div className="empty-state">
                    <div className="empty-state__icon">✅</div>
                    <p className="empty-state__title">No unsubscribed users</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
