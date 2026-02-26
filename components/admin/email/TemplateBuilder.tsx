"use client";

import { useState, useEffect } from "react";
import { OptionCards } from "./OptionCards";
import { EmailPreview } from "./EmailPreview";
import { EmailEditors } from "./EmailEditors";

/* ── Types ────────────────────────────────────────────── */

interface TemplateOption {
  id: string;
  templateId: string;
  optimizedSubject: string;
  optimizedPreviewText: string;
  blocks: { type: string; fields: Record<string, unknown> }[];
  notes: { angle: string; whoItsFor: string; recommendedAudience: string };
}

interface Toast {
  type: "success" | "error";
  message: string;
}

type Phase = "input" | "options" | "editor";

const TEMPLATE_CHOICES = [
  { value: "", label: "Auto choose (let AI decide)" },
  { value: "welcome_v1", label: "Welcome" },
  { value: "news_alert_v1", label: "Breaking News Alert" },
  { value: "weekly_digest_v1", label: "Weekly Digest" },
  { value: "visa_update_v1", label: "Visa and Requirements Update" },
  { value: "new_places_v1", label: "New Places Spotlight" },
];

/* ── Component ──────────────────────────────────────────── */

export function TemplateBuilder() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [phase, setPhase] = useState<Phase>("input");

  // Input fields
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [objective, setObjective] = useState("");
  const [audienceSegment, setAudienceSegment] = useState("");
  const [tone, setTone] = useState("Friendly and professional");
  const [length, setLength] = useState("Medium (2-3 short paragraphs)");
  const [callToAction, setCallToAction] = useState("");
  const [preferredTemplate, setPreferredTemplate] = useState("");
  const [city, setCity] = useState("");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [options, setOptions] = useState<TemplateOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<TemplateOption | null>(null);

  // Editor state (post-render)
  const [rendering, setRendering] = useState(false);
  const [html, setHtml] = useState("");
  const [textVersion, setTextVersion] = useState("");
  const [finalSubject, setFinalSubject] = useState("");
  const [finalPreviewText, setFinalPreviewText] = useState("");

  // Send/save state
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── AI Optimize Subject ─────────────────────────────── */

  async function handleOptimizeSubject() {
    if (!subject) {
      setToast({ type: "error", message: "Enter a subject first." });
      return;
    }
    setOptimizing(true);
    try {
      const res = await fetch("/api/admin/email/generate-with-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: `Optimize this email subject line for higher open rates: "${subject}". Also propose preview text. Return JSON: { "subject": "...", "previewText": "...", "htmlContent": "", "textContent": "" }`,
          tone: "Direct and compelling",
          lengthPreference: "Short (1-2 paragraphs)",
        }),
      });
      const data = await res.json();
      if (res.ok && data.generated?.subject) {
        setSubject(data.generated.subject);
        if (data.generated.previewText) setPreviewText(data.generated.previewText);
        setToast({ type: "success", message: "Subject optimized." });
      } else {
        setToast({ type: "error", message: data.error || "Optimization failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setOptimizing(false);
    }
  }

  /* ── Generate 3 Options ──────────────────────────────── */

  async function handleGenerateOptions() {
    if (!subject || !objective) {
      setToast({ type: "error", message: "Subject and objective are required." });
      return;
    }
    setGenerating(true);
    setOptions([]);
    setSelectedOption(null);
    try {
      const res = await fetch("/api/admin/email/templates/generate-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          previewText,
          objective,
          audienceSegment,
          tone,
          length,
          callToAction,
          preferredTemplateId: preferredTemplate || undefined,
          context: {
            city: city || undefined,
            campaignType: "campaign",
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.options) {
        setOptions(data.options);
        setPhase("options");
        setToast({ type: "success", message: "3 options generated. Select one below." });
      } else {
        const msg = data.validationErrors
          ? `Validation issues: ${data.validationErrors.slice(0, 3).join("; ")}`
          : data.error || "Generation failed.";
        setToast({ type: "error", message: msg });
        // If partial options exist despite validation errors, still show them
        if (data.options?.length) {
          setOptions(data.options);
          setPhase("options");
        }
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setGenerating(false);
    }
  }

  /* ── Render Selected Option ──────────────────────────── */

  async function handleRenderEmail() {
    if (!selectedOption) {
      setToast({ type: "error", message: "Select an option first." });
      return;
    }
    setRendering(true);
    try {
      const res = await fetch("/api/admin/email/templates/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedOption,
          links: {
            unsubscribeUrl: "https://globescraper.com/api/email/unsubscribe",
            preferencesUrl: "https://globescraper.com/community/edit-profile",
            siteUrl: "https://globescraper.com",
          },
          year: new Date().getFullYear(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.html) {
        setHtml(data.html);
        setTextVersion(data.textVersion || "");
        setFinalSubject(data.subject);
        setFinalPreviewText(data.previewText);
        setPhase("editor");
        setToast({ type: "success", message: "Email rendered. Review and edit below." });
      } else {
        setToast({ type: "error", message: data.error || "Render failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setRendering(false);
    }
  }

  /* ── Send Test ────────────────────────────────────────── */

  async function handleSendTest() {
    if (!html) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/email/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "ADMIN_SELF",
          subject: `[TEST] ${finalSubject}`,
          htmlContent: html,
        }),
      });
      const data = await res.json();
      if (res.ok) setToast({ type: "success", message: "Test email sent to your inbox." });
      else setToast({ type: "error", message: data.error || "Send failed." });
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSending(false);
    }
  }

  /* ── Save as Draft Campaign ──────────────────────────── */

  async function handleSaveDraft() {
    if (!html || !finalSubject) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: finalSubject,
          previewText: finalPreviewText,
          htmlContent: html,
          textContent: textVersion,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: "success", message: "Campaign saved as draft." });
      } else {
        setToast({ type: "error", message: data.error || "Save failed." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSending(false);
    }
  }

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="em-template-builder">
      {/* Toast */}
      {toast && (
        <div className={`em-toast em-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button className="em-toast__close" onClick={() => setToast(null)}>x</button>
        </div>
      )}

      {/* Phase navigation breadcrumb */}
      <div className="em-tb-phases">
        <button
          className={`em-tb-phases__item ${phase === "input" ? "em-tb-phases__item--active" : ""}`}
          onClick={() => setPhase("input")}
        >
          1. Configure
        </button>
        <span className="em-tb-phases__arrow">&#8594;</span>
        <button
          className={`em-tb-phases__item ${phase === "options" ? "em-tb-phases__item--active" : ""}`}
          onClick={() => options.length > 0 && setPhase("options")}
          disabled={options.length === 0}
        >
          2. Choose Option
        </button>
        <span className="em-tb-phases__arrow">&#8594;</span>
        <button
          className={`em-tb-phases__item ${phase === "editor" ? "em-tb-phases__item--active" : ""}`}
          onClick={() => html && setPhase("editor")}
          disabled={!html}
        >
          3. Edit and Send
        </button>
      </div>

      {/* ── Phase 1: Configure ─────────────────────────── */}
      {phase === "input" && (
        <div className="em-panel">
          <div className="em-panel__header">
            <h3 className="em-panel__title">Template Builder</h3>
          </div>
          <div className="em-panel__body">
            {/* Template choice */}
            <div className="em-field">
              <label className="em-field__label">Template</label>
              <select
                className="em-field__select"
                value={preferredTemplate}
                onChange={(e) => setPreferredTemplate(e.target.value)}
              >
                {TEMPLATE_CHOICES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Subject + AI Optimize */}
            <div className="em-field">
              <label className="em-field__label">
                Subject *
                <button
                  className="em-field__ai-btn"
                  onClick={handleOptimizeSubject}
                  disabled={optimizing}
                >
                  {optimizing ? "..." : "✨ AI Optimize"}
                </button>
              </label>
              <input
                type="text"
                className="em-field__input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
                maxLength={80}
              />
            </div>

            {/* Preview Text */}
            <div className="em-field">
              <label className="em-field__label">Preview Text</label>
              <input
                type="text"
                className="em-field__input"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Short preview shown in inbox (leave blank to auto-generate)"
                maxLength={120}
              />
            </div>

            {/* Objective */}
            <div className="em-field">
              <label className="em-field__label">Objective *</label>
              <input
                type="text"
                className="em-field__input"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Welcome new teachers, alert about visa changes"
              />
            </div>

            {/* Audience + City */}
            <div className="em-field-row">
              <div className="em-field">
                <label className="em-field__label">Audience Segment</label>
                <input
                  className="em-field__input"
                  value={audienceSegment}
                  onChange={(e) => setAudienceSegment(e.target.value)}
                  placeholder="e.g. South African teachers"
                />
              </div>
              <div className="em-field">
                <label className="em-field__label">City (optional)</label>
                <select className="em-field__select" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Any / all</option>
                  <option value="Phnom Penh">Phnom Penh</option>
                  <option value="Siem Reap">Siem Reap</option>
                </select>
              </div>
            </div>

            {/* Tone + Length */}
            <div className="em-field-row">
              <div className="em-field">
                <label className="em-field__label">Tone</label>
                <select className="em-field__select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option>Friendly and professional</option>
                  <option>Casual and warm</option>
                  <option>Informational</option>
                  <option>Exciting and energetic</option>
                  <option>Urgent and direct</option>
                </select>
              </div>
              <div className="em-field">
                <label className="em-field__label">Length</label>
                <select className="em-field__select" value={length} onChange={(e) => setLength(e.target.value)}>
                  <option>Short (1-2 paragraphs)</option>
                  <option>Medium (2-3 short paragraphs)</option>
                  <option>Longer (3-4 paragraphs)</option>
                </select>
              </div>
            </div>

            {/* CTA */}
            <div className="em-field">
              <label className="em-field__label">Call to Action</label>
              <input
                className="em-field__input"
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                placeholder="e.g. Complete your profile, Read the full guide"
              />
            </div>

            {/* Generate button */}
            <div className="em-actions" style={{ marginTop: "1.25rem" }}>
              <button
                className="btn btn--primary"
                onClick={handleGenerateOptions}
                disabled={generating}
              >
                {generating ? (
                  <><span className="em-spinner" /> Generating 3 Options...</>
                ) : (
                  "✨ Generate Content Options"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 2: Choose Option ─────────────────────── */}
      {phase === "options" && (
        <div className="em-panel">
          <div className="em-panel__header">
            <h3 className="em-panel__title">Select a Content Option</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => setPhase("input")}>
              ← Back to Configure
            </button>
          </div>
          <div className="em-panel__body">
            <OptionCards
              options={options}
              selectedId={selectedOption?.id || null}
              onSelect={(opt) => setSelectedOption(opt)}
            />

            {selectedOption && (
              <div className="em-actions" style={{ marginTop: "1.25rem" }}>
                <button
                  className="btn btn--primary"
                  onClick={handleRenderEmail}
                  disabled={rendering}
                >
                  {rendering ? (
                    <><span className="em-spinner" /> Rendering Email...</>
                  ) : (
                    "Generate Email (HTML)"
                  )}
                </button>
                <button className="btn btn--outline" onClick={() => { setPhase("input"); }}>
                  ← Modify Inputs
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 3: Edit and Send ─────────────────────── */}
      {phase === "editor" && html && (
        <div className="em-panel">
          <div className="em-panel__header">
            <h3 className="em-panel__title">Review and Send</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => setPhase("options")}>
              ← Back to Options
            </button>
          </div>
          <div className="em-panel__body">
            <EmailEditors
              html={html}
              textVersion={textVersion}
              subject={finalSubject}
              previewText={finalPreviewText}
              onHtmlChange={setHtml}
              onTextChange={setTextVersion}
              onSubjectChange={setFinalSubject}
              onPreviewTextChange={setFinalPreviewText}
              PreviewComponent={<EmailPreview html={html} />}
            />

            <div className="em-actions" style={{ marginTop: "1.25rem" }}>
              <button
                className="btn btn--primary"
                onClick={handleSaveDraft}
                disabled={sending}
              >
                {sending ? "Saving..." : "Save as Draft Campaign"}
              </button>
              <button
                className="btn btn--outline"
                onClick={handleSendTest}
                disabled={sending}
              >
                Send Test Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
