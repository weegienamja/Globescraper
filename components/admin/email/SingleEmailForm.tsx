"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ── Types ──────────────────────────────────────────────── */

interface UserEntry {
  id: string;
  email: string;
  name: string | null;
  emailMarketingOptIn: boolean;
  emailUnsubscribed: boolean;
}

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  isManual?: boolean;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

interface Props {
  users: UserEntry[];
}

/* ── Helpers ────────────────────────────────────────────── */

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Component ──────────────────────────────────────────── */

export function SingleEmailForm({ users }: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredUsers = users.filter((u) => {
    if (recipients.some((r) => r.id === u.id)) return false;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q))
    );
  });

  function addRecipient(user: UserEntry) {
    setRecipients((prev) => [
      ...prev,
      { id: user.id, email: user.email, name: user.name },
    ]);
    setSearch("");
    setShowDropdown(false);
  }

  function addManualEmail(email: string) {
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) return;
    if (recipients.some((r) => r.email === trimmed)) return;
    setRecipients((prev) => [
      ...prev,
      { id: `manual-${trimmed}`, email: trimmed, name: null, isManual: true },
    ]);
    setSearch("");
    setShowDropdown(false);
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      if (filteredUsers.length > 0) {
        addRecipient(filteredUsers[0]);
      } else if (isValidEmail(search.trim())) {
        addManualEmail(search);
      }
    }
    if (e.key === "Backspace" && search === "" && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1].id);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.includes(",")) {
      e.preventDefault();
      const emails = text.split(",").map((s) => s.trim()).filter(isValidEmail);
      emails.forEach((email) => {
        if (!recipients.some((r) => r.email === email)) {
          const existingUser = users.find((u) => u.email === email);
          if (existingUser) {
            addRecipient(existingUser);
          } else {
            addManualEmail(email);
          }
        }
      });
    }
  }

  const getEditorContent = useCallback(() => {
    if (isHtmlMode) return htmlContent;
    return editorRef.current?.innerHTML || "";
  }, [isHtmlMode, htmlContent]);

  function execCommand(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  function handleInsertLink() {
    const url = prompt("Enter URL:");
    if (url) execCommand("createLink", url);
  }

  function handleInsertImage() {
    const url = prompt("Enter image URL:");
    if (url) execCommand("insertImage", url);
  }

  async function handleSendTest() {
    const content = getEditorContent();
    if (!subject || !content) {
      setToast({ type: "error", message: "Subject and message are required." });
      return;
    }

    setSendingTest(true);
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
        setToast({ type: "error", message: data.error || "Failed to send test." });
      }
    } catch {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSendingTest(false);
    }
  }

  function handleSendClick() {
    const content = getEditorContent();
    if (recipients.length === 0) {
      setToast({ type: "error", message: "Add at least one recipient." });
      return;
    }
    if (!subject || !content) {
      setToast({ type: "error", message: "Subject and message are required." });
      return;
    }
    setConfirmText("");
    setShowConfirmModal(true);
  }

  async function handleConfirmedSend() {
    if (confirmText !== "SEND") return;
    setShowConfirmModal(false);
    setSending(true);

    const content = getEditorContent();
    let successCount = 0;
    let failCount = 0;

    for (const r of recipients) {
      try {
        const body: Record<string, string> = {
          subject,
          htmlContent: content,
        };

        if (r.isManual) {
          body.email = r.email;
        } else {
          body.userId = r.id;
        }

        const res = await fetch("/api/admin/email/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setSending(false);

    if (failCount === 0) {
      setToast({
        type: "success",
        message: `Email sent to ${successCount} recipient${successCount !== 1 ? "s" : ""}.`,
      });
      setRecipients([]);
      setSubject("");
      setHtmlContent("");
      if (editorRef.current) editorRef.current.innerHTML = "";
    } else {
      setToast({
        type: "error",
        message: `${successCount} sent, ${failCount} failed.`,
      });
    }
  }

  return (
    <div className="em-single">
      {/* Toast notification */}
      {toast && (
        <div className={`em-toast em-toast--${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.message}
          <button className="em-toast__close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="em-panel">
        <div className="em-panel__header">
          <div>
            <h3 className="em-panel__title">Send Single Email</h3>
            <p className="em-panel__subtitle">Send a direct email to a specific user.</p>
          </div>
        </div>

        <div className="em-panel__body">
        {/* Recipients */}
        <div className="em-field">
          <label className="em-field__label">
            Recipient
            {recipients.length > 0 && (
              <span className="em-field__count">{recipients.length} selected</span>
            )}
          </label>
          <div className="em-recipients">
            <div className="em-recipients__input-wrap">
              {recipients.map((r) => (
                <span key={r.id} className="em-pill">
                  {r.name || r.email}
                  <button
                    className="em-pill__remove"
                    onClick={() => removeRecipient(r.id)}
                    aria-label={`Remove ${r.email}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={searchRef}
                type="text"
                className="em-recipients__input"
                placeholder={recipients.length === 0 ? "Search email or username..." : "Add more..."}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={handleSearchKeyDown}
                onPaste={handlePaste}
              />
            </div>
            {showDropdown && search.length > 0 && (
              <div ref={dropdownRef} className="em-dropdown">
                {filteredUsers.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    className="em-dropdown__item"
                    onClick={() => addRecipient(u)}
                  >
                    <span className="em-dropdown__name">{u.name || "No name"}</span>
                    <span className="em-dropdown__email">{u.email}</span>
                    {u.emailUnsubscribed && (
                      <span className="admin__badge admin__badge--danger">Unsub</span>
                    )}
                  </button>
                ))}
                {filteredUsers.length === 0 && isValidEmail(search.trim()) && (
                  <button
                    className="em-dropdown__item"
                    onClick={() => addManualEmail(search)}
                  >
                    <span className="em-dropdown__name">Send to:</span>
                    <span className="em-dropdown__email">{search.trim()}</span>
                  </button>
                )}
                {filteredUsers.length === 0 && !isValidEmail(search.trim()) && (
                  <div className="em-dropdown__empty">No matching users found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subject */}
        <div className="em-field">
          <label className="em-field__label">Subject *</label>
          <input
            type="text"
            className="em-field__input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Write the subject line..."
            maxLength={200}
          />
        </div>

        {/* Editor */}
        <div className="em-field">
          <label className="em-field__label">Message</label>
          <div className="em-editor">
            <div className="em-editor__toolbar">
              <button
                className={`em-editor__mode ${isHtmlMode ? "em-editor__mode--active" : ""}`}
                onClick={() => {
                  if (!isHtmlMode && editorRef.current) {
                    setHtmlContent(editorRef.current.innerHTML);
                  } else if (isHtmlMode && editorRef.current) {
                    editorRef.current.innerHTML = htmlContent;
                  }
                  setIsHtmlMode(!isHtmlMode);
                }}
                title={isHtmlMode ? "Switch to visual editor" : "Switch to HTML source"}
              >
                HTML
              </button>
              {!isHtmlMode && (
                <>
                  <div className="em-editor__separator" />
                  <button className="em-editor__btn" onClick={() => execCommand("bold")} title="Bold">
                    <strong>B</strong>
                  </button>
                  <button className="em-editor__btn" onClick={() => execCommand("italic")} title="Italic">
                    <em>I</em>
                  </button>
                  <button className="em-editor__btn" onClick={() => execCommand("underline")} title="Underline">
                    <u>U</u>
                  </button>
                  <button className="em-editor__btn" onClick={() => execCommand("strikeThrough")} title="Strikethrough">
                    <s>S</s>
                  </button>
                  <div className="em-editor__separator" />
                  <button className="em-editor__btn" onClick={handleInsertLink} title="Insert Link">
                    🔗
                  </button>
                  <button className="em-editor__btn" onClick={() => execCommand("insertUnorderedList")} title="Bullet List">
                    ☰
                  </button>
                  <button className="em-editor__btn" onClick={() => execCommand("insertOrderedList")} title="Numbered List">
                    ≡
                  </button>
                  <button className="em-editor__btn" onClick={() => execCommand("formatBlock", "pre")} title="Code Block">
                    {"</>"}
                  </button>
                  <div className="em-editor__separator" />
                  <button className="em-editor__btn" onClick={handleInsertImage} title="Insert Image">
                    🖼
                  </button>
                </>
              )}
            </div>
            {isHtmlMode ? (
              <textarea
                className="em-editor__html"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<h1>Hello!</h1><p>Your message here...</p>"
                rows={10}
              />
            ) : (
              <div
                ref={editorRef}
                className="em-editor__content"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Your email..."
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="em-actions">
          <button
            className="btn btn--outline btn--sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "Hide Preview" : "🖹 Preview"}
          </button>
          <button
            className="btn btn--primary btn--send"
            onClick={handleSendClick}
            disabled={sending}
          >
            {sending ? (
              <><span className="em-spinner" /> Sending...</>
            ) : (
              "Send Email"
            )}
          </button>
        </div>

        {/* Send Test (secondary) */}
        <div className="em-send-test">
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleSendTest}
            disabled={sendingTest}
          >
            {sendingTest ? "Sending test..." : "Send test to my inbox"}
          </button>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="em-preview">
            <div className="em-preview__header">Email Preview</div>
            <div
              className="em-preview__body"
              dangerouslySetInnerHTML={{
                __html: isHtmlMode ? htmlContent : editorRef.current?.innerHTML || "",
              }}
            />
          </div>
        )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="admin__modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="admin__modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin__modal-header">
              <h3>Confirm Send</h3>
              <button className="admin__modal-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div className="admin__modal-body">
              <p style={{ marginBottom: "1rem" }}>
                You are about to send this email to <strong>{recipients.length} recipient{recipients.length !== 1 ? "s" : ""}</strong>.
              </p>
              <p style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Type <strong>SEND</strong> to confirm.
              </p>
              <input
                type="text"
                className="em-field__input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type SEND to confirm"
                autoFocus
              />
              <div className="admin__modal-actions">
                <button className="btn btn--outline btn--sm" onClick={() => setShowConfirmModal(false)}>
                  Cancel
                </button>
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
    </div>
  );
}
