"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function MessageInput({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [body]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/messages/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        });
        if (res.ok) {
          setBody("");
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to send message");
        }
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="chat-composer">
      {error && <div className="chat-composer__error">{error}</div>}
      <form onSubmit={handleSubmit} className="chat-composer__bar">
        <button type="button" className="chat-composer__icon-btn" aria-label="Attach file" tabIndex={-1}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={2000}
          rows={1}
          className="chat-composer__input"
          disabled={pending}
        />
        <button type="button" className="chat-composer__icon-btn" aria-label="Emoji" tabIndex={-1}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="chat-composer__send"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span className="chat-composer__send-label">Send</span>
        </button>
      </form>
    </div>
  );
}
