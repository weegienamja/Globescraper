"use client";

import { useState, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────── */

interface ImageSlot {
  slot: string; // "hero" or the heading text
  label: string; // display label
  imageUrl: string; // current image URL or ""
  altText: string;
  caption: string;
}

interface Props {
  postId: string;
  images: ImageSlot[];
}

/* ── Per-image box ─────────────────────────────────────── */

function ImageBox({
  postId,
  image,
  onUpdate,
}: {
  postId: string;
  image: ImageSlot;
  onUpdate: (slot: string, patch: Partial<ImageSlot>) => void;
}) {
  const [customUrl, setCustomUrl] = useState("");
  const [altText, setAltText] = useState(image.altText);
  const [caption, setCaption] = useState(image.caption);
  const [busy, setBusy] = useState<string | null>(null); // action name or null
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const api = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/blog/${postId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: image.slot, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      return data;
    },
    [postId, image.slot]
  );

  async function handleRegenerate() {
    setBusy("regen");
    setMsg(null);
    try {
      const data = await api({ action: "regenerate" });
      onUpdate(image.slot, {
        imageUrl: data.imageUrl,
        altText: data.altText,
        caption: data.caption,
      });
      setAltText(data.altText);
      setCaption(data.caption);
      setMsg({ text: "Image regenerated and published.", type: "ok" });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setBusy(null);
    }
  }

  async function handleSetUrl() {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    setBusy("url");
    setMsg(null);
    try {
      const data = await api({ action: "set-url", url: trimmed, altText, caption });
      onUpdate(image.slot, {
        imageUrl: data.imageUrl,
        altText: data.altText,
        caption: data.caption,
      });
      setAltText(data.altText);
      setCaption(data.caption);
      setCustomUrl("");
      setMsg({ text: "Image saved and published.", type: "ok" });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveSeo() {
    setBusy("seo");
    setMsg(null);
    try {
      await api({ action: "update-seo", altText, caption });
      onUpdate(image.slot, { altText, caption });
      setMsg({ text: "SEO saved.", type: "ok" });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateSeo() {
    setBusy("ai-seo");
    setMsg(null);
    try {
      const data = await api({ action: "generate-seo" });
      setAltText(data.altText);
      setCaption(data.caption);
      onUpdate(image.slot, { altText: data.altText, caption: data.caption });
      setMsg({ text: "AI SEO generated and saved.", type: "ok" });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setBusy(null);
    }
  }

  const isBusy = !!busy;

  return (
    <div className="admin-img-mgr__box">
      <h5 className="admin-img-mgr__slot-label">{image.label}</h5>

      {/* Image preview */}
      <div className="admin-img-mgr__preview">
        {image.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image.imageUrl} alt={altText || image.label} className="admin-img-mgr__img" />
        ) : (
          <div className="admin-img-mgr__empty">No image</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="admin-img-mgr__actions">
        <button
          className="admin-img-mgr__btn admin-img-mgr__btn--regen"
          disabled={isBusy}
          onClick={handleRegenerate}
        >
          {busy === "regen" ? "Regenerating…" : image.imageUrl ? "Regenerate" : "Generate Image"}
        </button>
      </div>

      {/* Custom URL */}
      <div className="admin-img-mgr__url-group">
        <input
          type="text"
          className="admin-img-mgr__input"
          placeholder="Paste image URL…"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          disabled={isBusy}
          onKeyDown={(e) => { if (e.key === "Enter") handleSetUrl(); }}
        />
        <button
          className="admin-img-mgr__btn admin-img-mgr__btn--save"
          disabled={isBusy || !customUrl.trim()}
          onClick={handleSetUrl}
        >
          {busy === "url" ? "Saving…" : "Save URL"}
        </button>
      </div>

      {/* SEO fields */}
      <div className="admin-img-mgr__seo">
        <label className="admin-img-mgr__label">
          Alt text
          <input
            type="text"
            className="admin-img-mgr__input"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            disabled={isBusy}
            maxLength={125}
            placeholder="Descriptive alt text…"
          />
        </label>
        <label className="admin-img-mgr__label">
          Caption
          <input
            type="text"
            className="admin-img-mgr__input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isBusy}
            maxLength={100}
            placeholder="Image caption…"
          />
        </label>
        <div className="admin-img-mgr__seo-actions">
          <button
            className="admin-img-mgr__btn admin-img-mgr__btn--seo-save"
            disabled={isBusy}
            onClick={handleSaveSeo}
          >
            {busy === "seo" ? "Saving…" : "Save SEO"}
          </button>
          <button
            className="admin-img-mgr__btn admin-img-mgr__btn--ai-seo"
            disabled={isBusy}
            onClick={handleGenerateSeo}
          >
            {busy === "ai-seo" ? "Generating…" : "AI Generate SEO"}
          </button>
        </div>
      </div>

      {/* Status */}
      {msg && (
        <p className={`admin-img-mgr__msg admin-img-mgr__msg--${msg.type}`}>{msg.text}</p>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────── */

export default function AdminImageManager({ postId, images }: Props) {
  const [slots, setSlots] = useState<ImageSlot[]>(images);

  function handleUpdate(slot: string, patch: Partial<ImageSlot>) {
    setSlots((prev) =>
      prev.map((s) => (s.slot === slot ? { ...s, ...patch } : s))
    );
  }

  return (
    <div className="admin-img-mgr">
      <h4 className="admin-img-mgr__heading">Image Manager</h4>
      <p className="admin-img-mgr__subtitle">
        {slots.length} image slot{slots.length !== 1 ? "s" : ""}
      </p>
      {slots.map((img) => (
        <ImageBox
          key={img.slot}
          postId={postId}
          image={img}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}
