"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DraftData {
  id: string;
  title: string;
  slug: string;
  city: string;
  topic: string;
  audience: string;
  targetKeyword: string | null;
  secondaryKeywords: string | null;
  metaTitle: string;
  metaDescription: string;
  markdown: string;
  status: string;
  confidence: string;
  heroImageUrl: string | null;
  ogImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sources: Array<{
    id: string;
    url: string;
    title: string | null;
    publisher: string | null;
    fetchedAt: string;
  }>;
  images: Array<{
    id: string;
    kind: string;
    altText: string;
    storageUrl: string;
  }>;
  run: {
    modelUsed: string | null;
    tokenUsage: number | null;
    status: string;
  } | null;
}

interface Props {
  draft: DraftData;
}

export default function DraftEditorClient({ draft }: Props) {
  const [markdown, setMarkdown] = useState(draft.markdown);
  const [metaTitle, setMetaTitle] = useState(draft.metaTitle);
  const [metaDescription, setMetaDescription] = useState(draft.metaDescription);
  const [title, setTitle] = useState(draft.title);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [regeneratingImages, setRegeneratingImages] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [published, setPublished] = useState(draft.status === "PUBLISHED");
  const [showPreview, setShowPreview] = useState(true);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/admin/content-generator/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, metaTitle, metaDescription, markdown }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed.");
      }
      setSaveMsg("Saved successfully.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/admin/content-generator/drafts/${draft.id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Publish failed.");
      }
      setPublished(true);
      setSaveMsg("Published successfully.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleRegenerateImages() {
    if (!confirm("Regenerate all images for this draft? This will replace existing images.")) return;
    setRegeneratingImages(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/admin/content-generator/drafts/${draft.id}/regenerate-images`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Image regeneration failed.");
      }
      const data = await res.json();
      setSaveMsg(`Images regenerated (${data.imageCount} images). Reload to see changes.`);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Image regeneration failed.");
    } finally {
      setRegeneratingImages(false);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="cgen">
      <div className="cgen__header">
        <h1 className="cgen__title">Edit Draft</h1>
        <div className="cgen__nav">
          <Link href="/admin/content-generator/drafts" className="cgen__back-link">
            Back to Drafts
          </Link>
          <Link href="/admin/content-generator" className="btn btn--secondary">
            Generator
          </Link>
        </div>
      </div>

      {/* Status bar */}
      <div className="cgen__status-bar">
        <span className={`cgen__badge cgen__badge--${published ? "published" : "draft"}`}>
          {published ? "PUBLISHED" : "DRAFT"}
        </span>
        {draft.confidence === "LOW" && (
          <span className="cgen__badge cgen__badge--low">LOW CONFIDENCE</span>
        )}
        <span className="cgen__status-meta">
          Created: {fmtDate(draft.createdAt)}
        </span>
        {draft.run && (
          <span className="cgen__status-meta">
            Model: {draft.run.modelUsed || "unknown"}
            {draft.run.tokenUsage ? ` | Tokens: ${draft.run.tokenUsage}` : ""}
          </span>
        )}
        {draft.images.length > 0 && (
          <span className="cgen__status-meta">
            Images: {draft.images.length}
          </span>
        )}
      </div>

      {/* Metadata fields */}
      <div className="cgen__form-card">
        <div className="cgen__form-grid">
          <div className="cgen__field cgen__field--full">
            <label className="cgen__label" htmlFor="edit-title">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              className="cgen__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="edit-meta-title">
              Meta Title ({metaTitle.length}/60)
            </label>
            <input
              id="edit-meta-title"
              type="text"
              className="cgen__input"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="edit-meta-desc">
              Meta Description ({metaDescription.length}/160)
            </label>
            <input
              id="edit-meta-desc"
              type="text"
              className="cgen__input"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              maxLength={160}
            />
          </div>
          <div className="cgen__field">
            <label className="cgen__label">City</label>
            <div className="cgen__readonly">{draft.city}</div>
          </div>
          <div className="cgen__field">
            <label className="cgen__label">Topic</label>
            <div className="cgen__readonly">{draft.topic}</div>
          </div>
          <div className="cgen__field">
            <label className="cgen__label">Audience</label>
            <div className="cgen__readonly">{draft.audience}</div>
          </div>
          <div className="cgen__field">
            <label className="cgen__label">Slug</label>
            <div className="cgen__readonly">/{draft.slug}</div>
          </div>
        </div>
      </div>

      {/* Toggle between Preview and Edit */}
      <div className="cgen__toggle-bar">
        <button
          className={`cgen__toggle-btn ${showPreview ? "cgen__toggle-btn--active" : ""}`}
          onClick={() => setShowPreview(true)}
        >
          Preview
        </button>
        <button
          className={`cgen__toggle-btn ${!showPreview ? "cgen__toggle-btn--active" : ""}`}
          onClick={() => setShowPreview(false)}
        >
          Edit Markdown
        </button>
      </div>

      {showPreview ? (
        <div className="cgen__preview-card">
          <div className="blog-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="cgen__editor-card">
          <textarea
            className="cgen__editor-textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={30}
          />
        </div>
      )}

      {/* Sources */}
      {draft.sources.length > 0 && (
        <div className="cgen__form-card">
          <h2 className="cgen__section-title">Sources ({draft.sources.length})</h2>
          <div className="cgen__sources-list">
            {draft.sources.map((source) => (
              <div key={source.id} className="cgen__source-item">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cgen__source-url"
                >
                  {source.title || source.url}
                </a>
                {source.publisher && (
                  <span className="cgen__source-pub">{source.publisher}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save message */}
      {saveMsg && (
        <div
          className={`cgen__alert ${
            saveMsg.includes("successfully")
              ? "cgen__alert--success"
              : "cgen__alert--error"
          }`}
        >
          {saveMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="cgen__actions cgen__actions--sticky">
        <button
          className="btn btn--secondary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          className="btn btn--secondary"
          onClick={handleRegenerateImages}
          disabled={regeneratingImages}
        >
          {regeneratingImages ? "Regenerating Images..." : "Regenerate Images"}
        </button>
        {!published && (
          <button
            className="btn btn--publish"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        )}
      </div>
    </div>
  );
}
