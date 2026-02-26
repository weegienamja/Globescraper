"use client";

import { useState } from "react";

/**
 * EmailEditors: Tabs for Preview | Edit HTML | Edit Text.
 * Also includes Copy HTML, warning banner, and action buttons.
 */

interface Props {
  html: string;
  textVersion: string;
  subject: string;
  previewText: string;
  onHtmlChange: (html: string) => void;
  onTextChange: (text: string) => void;
  onSubjectChange: (subject: string) => void;
  onPreviewTextChange: (previewText: string) => void;
  PreviewComponent: React.ReactNode;
}

type EditorTab = "preview" | "html" | "text";

export function EmailEditors({
  html,
  textVersion,
  subject,
  previewText,
  onHtmlChange,
  onTextChange,
  onSubjectChange,
  onPreviewTextChange,
  PreviewComponent,
}: Props) {
  const [tab, setTab] = useState<EditorTab>("preview");
  const [copied, setCopied] = useState(false);

  // Warnings
  const warnings: string[] = [];
  if (!html.includes("unsubscribe") && !html.includes("Unsubscribe")) {
    warnings.push("Unsubscribe link may be missing from the email.");
  }
  if (!textVersion.trim()) {
    warnings.push("Plain text version is empty. Some clients only show text.");
  }
  if (subject.length > 60) {
    warnings.push(`Subject is ${subject.length} chars (recommended: under 60).`);
  }
  const linkCount = (html.match(/href="/g) || []).length;
  if (linkCount > 15) {
    warnings.push(`Email contains ${linkCount} links. Consider reducing for deliverability.`);
  }

  async function handleCopyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  const tabs: { key: EditorTab; label: string }[] = [
    { key: "preview", label: "Preview" },
    { key: "html", label: "Edit HTML" },
    { key: "text", label: "Edit Text" },
  ];

  return (
    <div className="em-editors">
      {/* Editable subject + preview in editor mode */}
      <div className="em-editors__meta">
        <div className="em-field">
          <label className="em-field__label">Subject</label>
          <input
            type="text"
            className="em-field__input"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        </div>
        <div className="em-field">
          <label className="em-field__label">Preview Text</label>
          <input
            type="text"
            className="em-field__input"
            value={previewText}
            onChange={(e) => onPreviewTextChange(e.target.value)}
          />
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="em-editors__warnings">
          {warnings.map((w, i) => (
            <div key={i} className="em-editors__warning">&#9888; {w}</div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="em-editors__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`em-editors__tab ${tab === t.key ? "em-editors__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button className="em-editors__copy" onClick={handleCopyHtml}>
          {copied ? "Copied!" : "Copy HTML"}
        </button>
      </div>

      {/* Tab panels */}
      <div className="em-editors__panel">
        {tab === "preview" && PreviewComponent}
        {tab === "html" && (
          <textarea
            className="em-editors__textarea em-editors__textarea--html"
            value={html}
            onChange={(e) => onHtmlChange(e.target.value)}
            rows={30}
            spellCheck={false}
          />
        )}
        {tab === "text" && (
          <textarea
            className="em-editors__textarea"
            value={textVersion}
            onChange={(e) => onTextChange(e.target.value)}
            rows={20}
          />
        )}
      </div>
    </div>
  );
}
