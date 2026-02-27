"use client";

import { useState } from "react";

interface Props {
  postId: string;
  currentHeroUrl: string;
}

/**
 * Admin-only sidebar widget for changing the hero image of a blog post.
 * Two methods: (1) Regenerate via AI/real photo pipeline,
 * (2) Paste a custom URL. Both auto-publish on save.
 */
export default function AdminHeroEditor({ postId, currentHeroUrl }: Props) {
  const [heroUrl, setHeroUrl] = useState(currentHeroUrl);
  const [customUrl, setCustomUrl] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  async function handleRegenerate() {
    setRegenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/blog/${postId}/hero-image`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      setHeroUrl(data.heroImageUrl);
      setMessage({ text: "Hero image regenerated and published.", type: "ok" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed",
        type: "err",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSaveUrl() {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/blog/${postId}/hero-image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setHeroUrl(data.heroImageUrl);
      setCustomUrl("");
      setMessage({ text: "Hero image saved and published.", type: "ok" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed",
        type: "err",
      });
    } finally {
      setSaving(false);
    }
  }

  const busy = regenerating || saving;

  return (
    <div className="admin-hero-editor">
      <h4 className="admin-hero-editor__heading">Hero Image</h4>

      {/* Current image preview */}
      <div className="admin-hero-editor__preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroUrl}
          alt="Current hero"
          className="admin-hero-editor__img"
        />
      </div>

      {/* Regenerate button */}
      <button
        className="admin-hero-editor__btn admin-hero-editor__btn--regen"
        onClick={handleRegenerate}
        disabled={busy}
      >
        {regenerating ? "Regenerating…" : "Regenerate Hero Image"}
      </button>

      {/* Custom URL input */}
      <div className="admin-hero-editor__url-group">
        <input
          type="text"
          className="admin-hero-editor__input"
          placeholder="Paste image URL…"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveUrl();
          }}
        />
        <button
          className="admin-hero-editor__btn admin-hero-editor__btn--save"
          onClick={handleSaveUrl}
          disabled={busy || !customUrl.trim()}
        >
          {saving ? "Saving…" : "Save & Publish"}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <p
          className={`admin-hero-editor__msg admin-hero-editor__msg--${message.type}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
