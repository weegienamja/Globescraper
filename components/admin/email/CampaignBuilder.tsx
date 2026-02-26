"use client";

import { useState, useEffect, useRef } from "react";

/* ── Types ──────────────────────────────────────────────── */

interface Campaign {
  id: string;
  subject: string;
  previewText: string | null;
  htmlContent: string;
  textContent: string | null;
  status: string;
  segmentJson: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  bounceCount: number;
  createdAt: string;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

type Step = 1 | 2 | 3 | 4;

interface AudienceFilter {
  type: "all" | "verified" | "teachers" | "travellers" | "custom";
}

interface Props {
  initialCampaigns: Campaign[];
  eligibleCount: number;
}

/* ── Helpers ────────────────────────────────────────────── */

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
  };
  return `admin__badge ${map[status] || ""}`;
}

/* ── Component ──────────────────────────────────────────── */

export function CampaignBuilder({ initialCampaigns, eligibleCount }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showBuilder, setShowBuilder] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [toast, setToast] = useState<Toast | null>(null);

  // Step 1: Audience
  const [audience, setAudience] = useState<AudienceFilter>({ type: "all" });
  const [recipientCount, setRecipientCount] = useState(eligibleCount);

  // Step 2: Content
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Step 3: Options
  const [sendOption, setSendOption] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  // AI generation
  const [showAi, setShowAi] = useState(false);
  const [aiObjective, setAiObjective] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiTone, setAiTone] = useState("Friendly and professional");
  const [aiCta, setAiCta] = useState("");
  const [aiLength, setAiLength] = useState("Medium (2-3 short paragraphs)");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiOptimizing, setAiOptimizing] = useState(false);

  // Campaign operations
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pendingSendId, setPendingSendId] = useState<string | null>(null);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [newConfirmText, setNewConfirmText] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Update recipient count based on audience selection
  useEffect(() => {
    // For now, all filters point to eligible count
    // In a future version, this could call an API for real-time count
    setRecipientCount(eligibleCount);
  }, [audience, eligibleCount]);

  function execCommand(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }

  function getEditorContent(): string {
    if (isHtmlMode) return htmlContent;
    return editorRef.current?.innerHTML || "";
  }

  function resetBuilder() {
    setStep(1);
    setAudience({ type: "all" });
    setSubject("");
    setPreviewText("");
    setHtmlContent("");
    setTextContent("");
    setSendOption("now");
    setScheduledAt("");
    setShowAi(false);
    setShowBuilder(false);
    if (editorRef.current) editorRef.current.innerHTML = "";
  }

  /* ── AI Generation ─────────────────────────────────── */

  async function handleAiGenerate() {
    if (!aiObjective) {
      setToast({ type: "error", message: "Provide an objective." });
      return;
    }
    setAiGenerating(true);
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
        if (editorRef.current) editorRef.current.innerHTML = data.generated.htmlContent || "";
        setShowAi(false);
        setToast({ type: "success", message: "Content generated. Review and edit below." });
      } else {
        setToast({ type: "error", message: data.error || "AI generation failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleAiOptimizeSubject() {
    if (!subject) {
      setToast({ type: "error", message: "Enter a subject to optimize." });
      return;
    }
    setAiOptimizing(true);
    try {
      const res = await fetch("/api/admin/email/generate-with-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: `Optimize this email subject line for higher open rates: "${subject}". Return ONLY a new subject line.`,
          tone: "Direct and compelling",
          lengthPreference: "Short (1-2 paragraphs)",
        }),
      });
      const data = await res.json();
      if (res.ok && data.generated?.subject) {
        setSubject(data.generated.subject);
        setToast({ type: "success", message: "Subject optimized." });
      }
    } catch {
      setToast({ type: "error", message: "Optimization failed." });
    } finally {
      setAiOptimizing(false);
    }
  }

  /* ── Save Campaign ─────────────────────────────────── */

  async function handleSaveDraft() {
    const content = getEditorContent();
    if (!subject || !content) {
      setToast({ type: "error", message: "Subject and content are required." });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        subject,
        previewText,
        htmlContent: content,
        textContent,
        segmentJson: JSON.stringify(audience),
      };
      if (sendOption === "schedule" && scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }
      const res = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev]);
        resetBuilder();
        setToast({ type: "success", message: sendOption === "schedule" ? "Campaign scheduled." : "Campaign saved as draft." });
      } else {
        setToast({ type: "error", message: data.error || "Failed to save." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  /* ── Send Campaign ─────────────────────────────────── */

  function openSendConfirm(campaignId: string) {
    setPendingSendId(campaignId);
    setConfirmText("");
    setShowConfirmModal(true);
  }

  async function handleConfirmedSend() {
    if (confirmText !== "SEND" || !pendingSendId) return;
    setShowConfirmModal(false);
    setSendingId(pendingSendId);

    try {
      const res = await fetch("/api/admin/email/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: pendingSendId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === pendingSendId
              ? { ...c, status: "SENT", sentCount: data.sentCount, sentAt: new Date().toISOString() }
              : c,
          ),
        );
        setToast({ type: "success", message: `Campaign sent to ${data.sentCount} recipients.` });
      } else {
        setToast({ type: "error", message: data.error || "Send failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSendingId(null);
      setPendingSendId(null);
    }
  }

  /* ── Send New Campaign Directly ─────────────────────── */

  function openNewCampaignSendConfirm() {
    const content = getEditorContent();
    if (!subject || !content) {
      setToast({ type: "error", message: "Subject and content are required." });
      return;
    }
    setNewConfirmText("");
    setShowNewConfirm(true);
  }

  async function handleConfirmedNewSend() {
    if (newConfirmText !== "SEND") return;
    setShowNewConfirm(false);
    setSaving(true);

    try {
      // First save
      const content = getEditorContent();
      const body: Record<string, unknown> = {
        subject,
        previewText,
        htmlContent: content,
        textContent,
        segmentJson: JSON.stringify(audience),
      };
      const saveRes = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.campaign) {
        setToast({ type: "error", message: saveData.error || "Failed to save campaign." });
        setSaving(false);
        return;
      }

      // Then send
      const sendRes = await fetch("/api/admin/email/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: saveData.campaign.id }),
      });
      const sendData = await sendRes.json();
      if (sendRes.ok) {
        setCampaigns((prev) => [
          { ...saveData.campaign, status: "SENT", sentCount: sendData.sentCount, sentAt: new Date().toISOString() },
          ...prev,
        ]);
        resetBuilder();
        setToast({ type: "success", message: `Campaign sent to ${sendData.sentCount} recipients.` });
      } else {
        setCampaigns((prev) => [saveData.campaign, ...prev]);
        setToast({ type: "error", message: sendData.error || "Saved but send failed." });
        resetBuilder();
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCampaign(campaignId: string) {
    if (!confirm("Delete this campaign?")) return;
    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaignId}`, { method: "DELETE" });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
        setToast({ type: "success", message: "Campaign deleted." });
      }
    } catch {
      setToast({ type: "error", message: "Delete failed." });
    }
  }

  async function handleSendTestCampaign() {
    const content = getEditorContent();
    if (!subject || !content) {
      setToast({ type: "error", message: "Subject and content are required." });
      return;
    }
    try {
      const res = await fetch("/api/admin/email/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "ADMIN_SELF",
          subject: `[TEST] ${subject}`,
          htmlContent: content,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: "success", message: "Test email sent to your inbox." });
      } else {
        setToast({ type: "error", message: data.error || "Test failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    }
  }

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="em-campaigns">
      {toast && (
        <div className={`em-toast em-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button className="em-toast__close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Top Actions */}
      {!showBuilder && (
        <div className="em-actions" style={{ marginBottom: "1.5rem" }}>
          <button className="btn btn--primary" onClick={() => setShowBuilder(true)}>
            + New Campaign
          </button>
        </div>
      )}

      {/* Campaign Builder */}
      {showBuilder && (
        <div className="em-panel" style={{ marginBottom: "1.5rem" }}>
          <div className="em-panel__header">
            <h3 className="em-panel__title">Campaign Builder</h3>
            <button className="btn btn--ghost btn--sm" onClick={resetBuilder}>✕ Close</button>
          </div>

          {/* Step indicator */}
          <div className="em-steps">
            {[
              { n: 1 as Step, label: "Audience" },
              { n: 2 as Step, label: "Content" },
              { n: 3 as Step, label: "Options" },
              { n: 4 as Step, label: "Review" },
            ].map((s) => (
              <button
                key={s.n}
                className={`em-steps__item ${step === s.n ? "em-steps__item--active" : ""} ${step > s.n ? "em-steps__item--done" : ""}`}
                onClick={() => setStep(s.n)}
              >
                <span className="em-steps__num">{step > s.n ? "✓" : s.n}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Step 1: Audience */}
          {step === 1 && (
            <div className="em-step-content">
              <h4 className="em-step-content__title">Select Audience</h4>
              <div className="em-audience-grid">
                {(
                  [
                    { type: "all", label: "All Opted-In Users", desc: "All users who opted in to marketing emails", icon: "👥" },
                    { type: "verified", label: "Verified Users Only", desc: "Only users with verified email addresses", icon: "✅" },
                    { type: "teachers", label: "Teachers", desc: "Users interested in teaching (future filter)", icon: "📚" },
                    { type: "travellers", label: "Travellers", desc: "Users interested in travel (future filter)", icon: "✈️" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.type}
                    className={`em-audience-card ${audience.type === opt.type ? "em-audience-card--selected" : ""}`}
                    onClick={() => setAudience({ type: opt.type })}
                  >
                    <span className="em-audience-card__icon">{opt.icon}</span>
                    <strong>{opt.label}</strong>
                    <span className="em-audience-card__desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <div className="em-recipient-count">
                <span className="em-recipient-count__num">{recipientCount}</span> eligible recipients
              </div>
              <div className="em-step-nav">
                <span />
                <button className="btn btn--primary btn--sm" onClick={() => setStep(2)}>Next: Content →</button>
              </div>
            </div>
          )}

          {/* Step 2: Content */}
          {step === 2 && (
            <div className="em-step-content">
              <h4 className="em-step-content__title">Email Content</h4>

              <div className="em-field">
                <label className="em-field__label">
                  Subject *
                  <button
                    className="em-field__ai-btn"
                    onClick={handleAiOptimizeSubject}
                    disabled={aiOptimizing}
                    title="Optimize with AI"
                  >
                    {aiOptimizing ? "..." : "✨ AI Optimize"}
                  </button>
                </label>
                <input
                  type="text"
                  className="em-field__input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line"
                  maxLength={200}
                />
              </div>

              <div className="em-field">
                <label className="em-field__label">Preview Text</label>
                <input
                  type="text"
                  className="em-field__input"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="Short preview shown in inbox"
                  maxLength={200}
                />
              </div>

              {/* AI Generate Toggle */}
              <button
                className="btn btn--outline btn--sm"
                style={{ marginBottom: "1rem" }}
                onClick={() => setShowAi(!showAi)}
              >
                ✨ {showAi ? "Hide" : "Generate with"} AI
              </button>

              {showAi && (
                <div className="em-ai-form">
                  <div className="em-field">
                    <label className="em-field__label">Objective *</label>
                    <input
                      className="em-field__input"
                      value={aiObjective}
                      onChange={(e) => setAiObjective(e.target.value)}
                      placeholder="e.g. Welcome new teachers to the platform"
                    />
                  </div>
                  <div className="em-field">
                    <label className="em-field__label">Audience Segment</label>
                    <input
                      className="em-field__input"
                      value={aiAudience}
                      onChange={(e) => setAiAudience(e.target.value)}
                      placeholder="e.g. South African teachers"
                    />
                  </div>
                  <div className="em-field-row">
                    <div className="em-field">
                      <label className="em-field__label">Tone</label>
                      <select className="em-field__select" value={aiTone} onChange={(e) => setAiTone(e.target.value)}>
                        <option>Friendly and professional</option>
                        <option>Casual and warm</option>
                        <option>Informational</option>
                        <option>Exciting and energetic</option>
                      </select>
                    </div>
                    <div className="em-field">
                      <label className="em-field__label">Length</label>
                      <select className="em-field__select" value={aiLength} onChange={(e) => setAiLength(e.target.value)}>
                        <option>Short (1-2 paragraphs)</option>
                        <option>Medium (2-3 short paragraphs)</option>
                        <option>Longer (3-4 paragraphs)</option>
                      </select>
                    </div>
                  </div>
                  <div className="em-field">
                    <label className="em-field__label">Call to Action</label>
                    <input
                      className="em-field__input"
                      value={aiCta}
                      onChange={(e) => setAiCta(e.target.value)}
                      placeholder="e.g. Complete your profile"
                    />
                  </div>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? <><span className="em-spinner" /> Generating...</> : "✨ Generate Content"}
                  </button>
                </div>
              )}

              {/* Editor */}
              <div className="em-field" style={{ marginTop: showAi ? "1rem" : 0 }}>
                <label className="em-field__label">Message *</label>
                <div className="em-editor">
                  <div className="em-editor__toolbar">
                    <button
                      className={`em-editor__mode ${!isHtmlMode ? "em-editor__mode--active" : ""}`}
                      onClick={() => {
                        if (isHtmlMode && editorRef.current) editorRef.current.innerHTML = htmlContent;
                        setIsHtmlMode(false);
                      }}
                    >
                      Visual
                    </button>
                    <button
                      className={`em-editor__mode ${isHtmlMode ? "em-editor__mode--active" : ""}`}
                      onClick={() => {
                        if (!isHtmlMode && editorRef.current) setHtmlContent(editorRef.current.innerHTML);
                        setIsHtmlMode(true);
                      }}
                    >
                      HTML
                    </button>
                    <div className="em-editor__separator" />
                    {!isHtmlMode && (
                      <>
                        <button className="em-editor__btn" onClick={() => execCommand("bold")} title="Bold"><strong>B</strong></button>
                        <button className="em-editor__btn" onClick={() => execCommand("italic")} title="Italic"><em>I</em></button>
                        <button className="em-editor__btn" onClick={() => execCommand("underline")} title="Underline"><u>U</u></button>
                        <div className="em-editor__separator" />
                        <button className="em-editor__btn" onClick={() => {
                          const url = prompt("Enter URL:");
                          if (url) execCommand("createLink", url);
                        }} title="Insert Link">🔗</button>
                        <button className="em-editor__btn" onClick={() => execCommand("insertUnorderedList")} title="Bullet List">•≡</button>
                        <button className="em-editor__btn" onClick={() => execCommand("insertOrderedList")} title="Numbered List">1.</button>
                        <button className="em-editor__btn" onClick={() => {
                          const url = prompt("Enter image URL:");
                          if (url) execCommand("insertImage", url);
                        }} title="Insert Image">🖼️</button>
                      </>
                    )}
                  </div>
                  {isHtmlMode ? (
                    <textarea
                      className="em-editor__html"
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      placeholder="<h1>Hello!</h1><p>Your message here...</p>"
                      rows={14}
                    />
                  ) : (
                    <div
                      ref={editorRef}
                      className="em-editor__content"
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Compose your email..."
                    />
                  )}
                </div>
              </div>

              <div className="em-field">
                <label className="em-field__label">Plain Text (optional)</label>
                <textarea
                  className="em-field__textarea"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={3}
                  placeholder="Plain text fallback"
                />
              </div>

              <div className="em-step-nav">
                <button className="btn btn--outline btn--sm" onClick={() => setStep(1)}>← Audience</button>
                <button className="btn btn--primary btn--sm" onClick={() => setStep(3)}>Next: Options →</button>
              </div>
            </div>
          )}

          {/* Step 3: Options */}
          {step === 3 && (
            <div className="em-step-content">
              <h4 className="em-step-content__title">Send Options</h4>

              <div className="em-option-grid">
                <button
                  className={`em-option-card ${sendOption === "now" ? "em-option-card--selected" : ""}`}
                  onClick={() => setSendOption("now")}
                >
                  <span className="em-option-card__icon">🚀</span>
                  <strong>Send Now</strong>
                  <span className="em-option-card__desc">Send immediately to {recipientCount} recipients</span>
                </button>
                <button
                  className={`em-option-card ${sendOption === "schedule" ? "em-option-card--selected" : ""}`}
                  onClick={() => setSendOption("schedule")}
                >
                  <span className="em-option-card__icon">📅</span>
                  <strong>Schedule</strong>
                  <span className="em-option-card__desc">Pick a date and time</span>
                </button>
              </div>

              {sendOption === "schedule" && (
                <div className="em-field" style={{ maxWidth: "320px", marginTop: "1rem" }}>
                  <label className="em-field__label">Schedule Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="em-field__input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              )}

              <div className="em-actions" style={{ marginTop: "1.5rem" }}>
                <button className="btn btn--outline btn--sm" onClick={handleSendTestCampaign}>
                  📤 Send Test Email
                </button>
              </div>

              <div className="em-step-nav">
                <button className="btn btn--outline btn--sm" onClick={() => setStep(2)}>← Content</button>
                <button className="btn btn--primary btn--sm" onClick={() => setStep(4)}>Next: Review →</button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="em-step-content">
              <h4 className="em-step-content__title">Review Campaign</h4>

              <div className="em-review">
                <div className="em-review__row">
                  <span className="em-review__label">Audience</span>
                  <span className="em-review__value">{audience.type === "all" ? "All Opted-In" : audience.type} ({recipientCount} recipients)</span>
                </div>
                <div className="em-review__row">
                  <span className="em-review__label">Subject</span>
                  <span className="em-review__value">{subject || "—"}</span>
                </div>
                <div className="em-review__row">
                  <span className="em-review__label">Preview</span>
                  <span className="em-review__value">{previewText || "—"}</span>
                </div>
                <div className="em-review__row">
                  <span className="em-review__label">Send</span>
                  <span className="em-review__value">{sendOption === "now" ? "Immediately" : `Scheduled: ${scheduledAt || "not set"}`}</span>
                </div>
              </div>

              {/* HTML Preview */}
              <details className="em-preview-toggle">
                <summary>Preview Email</summary>
                <div
                  className="em-preview__body"
                  dangerouslySetInnerHTML={{ __html: getEditorContent() }}
                />
              </details>

              <div className="em-actions" style={{ marginTop: "1.5rem" }}>
                <button className="btn btn--outline btn--sm" onClick={() => setStep(3)}>← Back</button>
                <button
                  className="btn btn--outline"
                  onClick={handleSaveDraft}
                  disabled={saving}
                >
                  {saving ? "Saving..." : sendOption === "schedule" ? "Save & Schedule" : "Save as Draft"}
                </button>
                {sendOption === "now" && (
                  <button
                    className="btn btn--primary"
                    onClick={openNewCampaignSendConfirm}
                    disabled={saving}
                  >
                    {saving ? <><span className="em-spinner" /> Processing...</> : "🚀 Send Now"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaigns Table */}
      <div className="em-panel">
        <div className="em-panel__header">
          <h3 className="em-panel__title">Campaign History</h3>
        </div>
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
              {campaigns.map((c) => {
                const openRate = c.sentCount > 0 ? ((c.openCount / c.sentCount) * 100).toFixed(1) : "0";
                return (
                  <tr key={c.id}>
                    <td className="admin__td-date">{fmtDate(c.createdAt)}</td>
                    <td>
                      <strong>{c.subject}</strong>
                      {c.previewText && (
                        <div className="admin__sub-text">{c.previewText}</div>
                      )}
                    </td>
                    <td>
                      <span className={statusBadge(c.status)}>{c.status}</span>
                    </td>
                    <td>{c.sentCount}</td>
                    <td>{c.openCount} <span className="admin__sub-text">({openRate}%)</span></td>
                    <td>{c.bounceCount}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                          <>
                            <button
                              className="btn btn--primary btn--xs"
                              onClick={() => openSendConfirm(c.id)}
                              disabled={sendingId === c.id}
                            >
                              {sendingId === c.id ? "..." : "Send"}
                            </button>
                            <button
                              className="btn btn--ghost btn--xs"
                              onClick={() => handleDeleteCampaign(c.id)}
                            >
                              🗑
                            </button>
                          </>
                        )}
                        {c.status === "SENT" && (
                          <span className="admin__sub-text">Sent {c.sentAt ? fmtDate(c.sentAt) : ""}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state__icon">📨</div>
                      <p className="empty-state__title">No campaigns yet</p>
                      <p className="empty-state__text">Create your first email campaign.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send existing campaign confirm modal */}
      {showConfirmModal && (
        <div className="admin__modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin__modal-header">
              <h3>Confirm Campaign Send</h3>
              <button className="admin__modal-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div className="admin__modal-body">
              <p style={{ marginBottom: "1rem" }}>
                You are about to send this campaign to <strong>{eligibleCount} eligible recipients</strong>. This cannot be undone.
              </p>
              <p style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Type <strong>SEND</strong> to confirm.
              </p>
              <input
                type="text"
                className="em-field__input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type SEND"
                autoFocus
              />
              <div className="admin__modal-actions">
                <button className="btn btn--outline btn--sm" onClick={() => setShowConfirmModal(false)}>Cancel</button>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={confirmText !== "SEND"}
                  onClick={handleConfirmedSend}
                >
                  Confirm &amp; Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send new campaign confirm modal */}
      {showNewConfirm && (
        <div className="admin__modal-overlay" onClick={() => setShowNewConfirm(false)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin__modal-header">
              <h3>Confirm Send Now</h3>
              <button className="admin__modal-close" onClick={() => setShowNewConfirm(false)}>×</button>
            </div>
            <div className="admin__modal-body">
              <p style={{ marginBottom: "1rem" }}>
                This will save and immediately send the campaign to <strong>{recipientCount} recipients</strong>.
              </p>
              <p style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Type <strong>SEND</strong> to confirm.
              </p>
              <input
                type="text"
                className="em-field__input"
                value={newConfirmText}
                onChange={(e) => setNewConfirmText(e.target.value.toUpperCase())}
                placeholder="Type SEND"
                autoFocus
              />
              <div className="admin__modal-actions">
                <button className="btn btn--outline btn--sm" onClick={() => setShowNewConfirm(false)}>Cancel</button>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={newConfirmText !== "SEND"}
                  onClick={handleConfirmedNewSend}
                >
                  Confirm &amp; Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
