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
    <form onSubmit={handleSubmit} className="message-input">
      {error && <div className="message-input__error">{error}</div>}
      <div className="message-input__row">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={2000}
          rows={1}
          className="message-input__field"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="btn btn--primary message-input__send"
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
    </form>
  );
}
