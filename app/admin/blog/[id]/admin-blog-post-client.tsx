"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── Types ─────────────────────────────────────── */

interface SeoIssue {
  severity: "BLOCKER" | "MAJOR" | "MINOR";
  code: string;
  message: string;
  location: string;
  suggestion: string;
}

interface SeoChecks {
  metaTitleLengthOk?: boolean;
  metaDescriptionLengthOk?: boolean;
  keywordInFirst100Words?: boolean;
  h1Ok?: boolean;
  h2Count?: number;
  faqCount?: number;
  internalLinkCount?: number;
  sourcesWithUrls?: boolean;
  noEmDashes?: boolean;
  noAuthorCard?: boolean;
  noHtmlDetails?: boolean;
  noSourcesSection?: boolean;
  noFaqAPrefix?: boolean;
}

interface PostData {
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
  canonicalUrl: string | null;
  revisionNumber: number;
  lastSeoScore: number | null;
  lastSeoCheckedAt: string | null;
  seoIssuesJson: Record<string, unknown> | null;
  schemaJson: Record<string, unknown> | null;
  contentHash: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sources: Array<{ id: string; url: string; title: string | null; publisher: string | null; fetchedAt: string }>;
  images: Array<{ id: string; kind: string; altText: string; storageUrl: string }>;
  run: { modelUsed: string | null; tokenUsage: number | null; status: string } | null;
  revisions: Array<{ id: string; revisionNumber: number; title: string; createdAt: string }>;
}

interface PublishedPost {
  slug: string;
  title: string;
  targetKeyword: string | null;
  city: string;
}

interface Props {
  post: PostData;
  allPublished: PublishedPost[];
}

/* ─── Helpers ───────────────────────────────────── */

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

function computeQualityWarnings(
  post: PostData,
  markdown: string,
  seoScore: number | null
): string[] {
  const warnings: string[] = [];
  if (post.confidence === "LOW") warnings.push("Confidence: LOW (fewer than 3 sources)");
  if (post.sources.length < 3) warnings.push(`Only ${post.sources.length} source(s) found`);
  if (seoScore !== null && seoScore < 70) warnings.push(`SEO score is ${seoScore}/100`);

  // Check for em dashes
  if (/\u2014|\u2013/.test(markdown)) warnings.push("Em dashes detected in content");

  // Check required sections
  if (!/^## Quick Take/m.test(markdown)) warnings.push("Missing '## Quick Take' section");
  if (!/^## FAQ/m.test(markdown)) warnings.push("Missing '## FAQ' section");
  if (!/^## Related Guides/m.test(markdown)) warnings.push("Missing '## Related Guides' section");

  // Check for broken tables
  const tableLines = markdown.split("\n").filter((l) => l.trim().startsWith("|"));
  if (tableLines.length > 0) {
    const colCounts = tableLines.map((l) => l.split("|").length);
    const inconsistent = colCounts.some((c) => c !== colCounts[0]);
    if (inconsistent) warnings.push("Table formatting may be broken (inconsistent columns)");
  }

  // Check for HTML
  if (/<details>|<summary>/.test(markdown)) warnings.push("HTML <details>/<summary> tags found in content");

  // Check for "About the Author"
  if (/about the author/i.test(markdown)) warnings.push("\"About the Author\" section found in content");

  // Check for Sources section in markdown
  if (/^## Sources/m.test(markdown)) warnings.push("\"## Sources\" section found in markdown body");

  // Check for FAQ A: prefix
  if (/^A:/m.test(markdown)) warnings.push("FAQ answers prefixed with 'A:'");

  return warnings;
}

/* ─── Component ─────────────────────────────────── */

export default function AdminBlogPostClient({ post, allPublished }: Props) {
  // Editor state
  const [markdown, setMarkdown] = useState(post.markdown);
  const [title, setTitle] = useState(post.title);
  const [metaTitle, setMetaTitle] = useState(post.metaTitle);
  const [metaDescription, setMetaDescription] = useState(post.metaDescription);

  // View state
  const [view, setView] = useState<"preview" | "edit" | "diff">("preview");
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Action state
  const [saving, setSaving] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [seoChecking, setSeoChecking] = useState(false);
  const [seoFixing, setSeoFixing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  // SEO state
  const [seoScore, setSeoScore] = useState<number | null>(post.lastSeoScore);
  const [seoIssues, setSeoIssues] = useState<SeoIssue[]>(
    (post.seoIssuesJson as { issues?: SeoIssue[] })?.issues || []
  );
  const [seoChecks, setSeoChecks] = useState<SeoChecks>(
    (post.seoIssuesJson as { checks?: SeoChecks })?.checks || {}
  );

  // Computed values
  const hasChanges = markdown !== post.markdown || title !== post.title ||
    metaTitle !== post.metaTitle || metaDescription !== post.metaDescription;

  const qualityWarnings = useMemo(
    () => computeQualityWarnings(post, markdown, seoScore),
    [post, markdown, seoScore]
  );

  // Internal link suggestions
  const linkSuggestions = useMemo(() => {
    const currentLinks = markdown.match(/\]\(\/([\w-]+)\)/g)?.map((m) =>
      m.replace(/\]\(\//, "").replace(/\)/, "")
    ) || [];
    return allPublished.filter((p) => !currentLinks.includes(p.slug));
  }, [allPublished, markdown]);

  /* ─── Actions ──────────────────────────────── */

  function showMessage(text: string, type: "success" | "error") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 5000);
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, metaTitle, metaDescription, markdown }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed.");
      }
      showMessage("Draft changes saved.", "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRepublish() {
    setRepublishing(true);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}/republish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, metaTitle, metaDescription, markdown }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Republish failed.");
      }
      const data = await res.json();
      showMessage(`Republished. Revision #${data.revisionNumber}.`, "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Republish failed.", "error");
    } finally {
      setRepublishing(false);
    }
  }

  async function handleSeoCheck() {
    setSeoChecking(true);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}/seo-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, title, metaTitle, metaDescription }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "SEO check failed.");
      }
      const data = await res.json();
      setSeoScore(data.score);
      setSeoIssues(data.issues || []);
      setSeoChecks(data.checks || {});
      showMessage(`SEO check complete. Score: ${data.score}/100.`, "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "SEO check failed.", "error");
    } finally {
      setSeoChecking(false);
    }
  }

  async function handleSeoFix() {
    setSeoFixing(true);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}/seo-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, title, metaTitle, metaDescription }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "SEO fix failed.");
      }
      const data = await res.json();
      setTitle(data.title);
      setMetaTitle(data.metaTitle);
      setMetaDescription(data.metaDescription);
      setMarkdown(data.markdown);
      showMessage(`SEO fixes applied. ${data.notes || "Review changes then Republish."}`, "success");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "SEO fix failed.", "error");
    } finally {
      setSeoFixing(false);
    }
  }

  async function handleDelete() {
    if (deleteSlug !== post.slug) {
      showMessage("Slug does not match. Type the exact slug to confirm.", "error");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmSlug: deleteSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed.");
      }
      window.location.href = "/admin/blog";
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Delete failed.", "error");
      setDeleting(false);
    }
  }

  function insertInternalLink(slug: string, linkTitle: string) {
    const linkMd = `[${linkTitle}](/${slug})`;
    setMarkdown((prev) => {
      // Insert before "## Related Guides" if it exists
      const relatedIdx = prev.indexOf("## Related Guides");
      if (relatedIdx !== -1) {
        const nextNewline = prev.indexOf("\n", relatedIdx);
        if (nextNewline !== -1) {
          return prev.slice(0, nextNewline) + "\n*   " + linkMd + prev.slice(nextNewline);
        }
      }
      return prev + "\n\n" + linkMd;
    });
    showMessage(`Inserted link to /${slug}.`, "success");
  }

  /* ─── Diff view ───────────────────────────── */

  function renderDiff() {
    const oldLines = post.markdown.split("\n");
    const newLines = markdown.split("\n");
    const maxLen = Math.max(oldLines.length, newLines.length);
    const diffLines: Array<{ type: "same" | "add" | "remove"; text: string }> = [];

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i] ?? "";
      const newLine = newLines[i] ?? "";
      if (oldLine === newLine) {
        diffLines.push({ type: "same", text: oldLine });
      } else {
        if (oldLines[i] !== undefined) diffLines.push({ type: "remove", text: oldLine });
        if (newLines[i] !== undefined) diffLines.push({ type: "add", text: newLine });
      }
    }

    return (
      <pre className="abp__diff">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={
              line.type === "add"
                ? "abp__diff-add"
                : line.type === "remove"
                ? "abp__diff-remove"
                : ""
            }
          >
            <span className="abp__diff-marker">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            {line.text}
          </div>
        ))}
      </pre>
    );
  }

  /* ─── Render ──────────────────────────────── */

  return (
    <div className="abp">
      {/* Header */}
      <div className="abp__header">
        <h1 className="abp__title">Admin: {post.title}</h1>
        <div className="cgen__nav">
          <Link href="/admin/blog" className="cgen__back-link">
            Back to Blog Posts
          </Link>
          <Link href={`/${post.slug}`} className="btn btn--secondary" target="_blank">
            View Live
          </Link>
        </div>
      </div>

      {/* Message bar */}
      {msg && (
        <div className={`cgen__alert cgen__alert--${msgType === "success" ? "success" : "error"}`}>
          {msg}
        </div>
      )}

      {/* Main layout: content + sidebar */}
      <div className="abp__layout">
        {/* Main content area */}
        <div className="abp__main">
          {/* Status bar */}
          <div className="cgen__status-bar">
            <span className={`cgen__badge cgen__badge--${post.status === "PUBLISHED" ? "published" : "draft"}`}>
              {post.status}
            </span>
            {seoScore !== null && (
              <span className={`cgen__badge ${seoScore >= 80 ? "cgen__badge--published" : seoScore >= 50 ? "cgen__badge--low" : "cgen__badge--error"}`}>
                SEO: {seoScore}/100
              </span>
            )}
            {post.confidence === "LOW" && (
              <span className="cgen__badge cgen__badge--low">LOW CONFIDENCE</span>
            )}
            <span className="cgen__status-meta">Rev #{post.revisionNumber}</span>
            <span className="cgen__status-meta">Updated: {fmtDate(post.updatedAt)}</span>
            {hasChanges && <span className="cgen__badge cgen__badge--low">UNSAVED CHANGES</span>}
          </div>

          {/* Metadata fields */}
          <div className="cgen__form-card">
            <div className="cgen__form-grid">
              <div className="cgen__field cgen__field--full">
                <label className="cgen__label" htmlFor="abp-title">Title</label>
                <input id="abp-title" type="text" className="cgen__input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="cgen__field">
                <label className="cgen__label" htmlFor="abp-meta-title">Meta Title ({metaTitle.length}/60)</label>
                <input id="abp-meta-title" type="text" className="cgen__input" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={60} />
              </div>
              <div className="cgen__field">
                <label className="cgen__label" htmlFor="abp-meta-desc">Meta Description ({metaDescription.length}/160)</label>
                <input id="abp-meta-desc" type="text" className="cgen__input" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} maxLength={160} />
              </div>
              <div className="cgen__field">
                <label className="cgen__label">Slug</label>
                <div className="cgen__readonly">/{post.slug}</div>
              </div>
              <div className="cgen__field">
                <label className="cgen__label">Canonical</label>
                <div className="cgen__readonly">{post.canonicalUrl || `/${post.slug}`}</div>
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="cgen__toggle-bar">
            <button className={`cgen__toggle-btn ${view === "preview" ? "cgen__toggle-btn--active" : ""}`} onClick={() => setView("preview")}>
              Preview
            </button>
            <button className={`cgen__toggle-btn ${view === "edit" ? "cgen__toggle-btn--active" : ""}`} onClick={() => setView("edit")}>
              Edit Markdown
            </button>
            {hasChanges && (
              <button className={`cgen__toggle-btn ${view === "diff" ? "cgen__toggle-btn--active" : ""}`} onClick={() => setView("diff")}>
                Diff
              </button>
            )}
          </div>

          {/* Content area */}
          {view === "preview" && (
            <div className="cgen__preview-card">
              <div className="blog-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
              </div>
            </div>
          )}
          {view === "edit" && (
            <div className="cgen__editor-card">
              <textarea
                className="cgen__editor-textarea"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                rows={40}
              />
            </div>
          )}
          {view === "diff" && (
            <div className="cgen__editor-card">{renderDiff()}</div>
          )}

          {/* Action buttons */}
          <div className="cgen__actions cgen__actions--sticky">
            <button className="btn btn--secondary" onClick={handleSaveDraft} disabled={saving || !hasChanges}>
              {saving ? "Saving..." : "Save Draft Changes"}
            </button>
            <button className="btn btn--publish" onClick={handleRepublish} disabled={republishing}>
              {republishing ? "Republishing..." : "Republish"}
            </button>
            <button className="btn btn--secondary" onClick={handleSeoCheck} disabled={seoChecking}>
              {seoChecking ? "Checking..." : "SEO Check"}
            </button>
            {seoScore !== null && seoScore < 100 && (
              <button className="btn btn--secondary" onClick={handleSeoFix} disabled={seoFixing}>
                {seoFixing ? "Fixing..." : "Auto Fix SEO Issues"}
              </button>
            )}
            <button className="btn btn--danger" onClick={() => setShowDeleteModal(true)}>
              Delete Post
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="abp__sidebar">
          {/* SEO Results Panel */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "seo" ? null : "seo")}>
              SEO Results {seoScore !== null ? `(${seoScore}/100)` : ""}
            </button>
            {activePanel === "seo" && (
              <div className="abp__panel-body">
                {seoScore === null ? (
                  <p className="abp__panel-empty">Run an SEO check to see results.</p>
                ) : (
                  <>
                    <div className="abp__seo-score" data-score={seoScore >= 80 ? "good" : seoScore >= 50 ? "ok" : "bad"}>
                      <span className="abp__seo-score-num">{seoScore}</span>/100
                    </div>
                    {/* Checks summary */}
                    <div className="abp__checks-grid">
                      {Object.entries(seoChecks).map(([key, val]) => (
                        <div key={key} className={`abp__check ${val === true ? "abp__check--pass" : val === false ? "abp__check--fail" : ""}`}>
                          <span className="abp__check-icon">{val === true ? "\u2713" : val === false ? "\u2717" : typeof val === "number" ? val : "?"}</span>
                          <span className="abp__check-label">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        </div>
                      ))}
                    </div>
                    {/* Issues grouped by severity */}
                    {seoIssues.length > 0 && (
                      <div className="abp__issues">
                        {(["BLOCKER", "MAJOR", "MINOR"] as const).map((sev) => {
                          const filtered = seoIssues.filter((i) => i.severity === sev);
                          if (filtered.length === 0) return null;
                          return (
                            <div key={sev} className="abp__issue-group">
                              <h4 className={`abp__issue-sev abp__issue-sev--${sev.toLowerCase()}`}>{sev} ({filtered.length})</h4>
                              {filtered.map((issue, i) => (
                                <div key={i} className="abp__issue">
                                  <span className="abp__issue-code">[{issue.code}]</span>
                                  <span className="abp__issue-msg">{issue.message}</span>
                                  {issue.suggestion && <span className="abp__issue-fix">Fix: {issue.suggestion}</span>}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {seoIssues.length === 0 && <p className="abp__panel-empty">No issues found.</p>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quality Score Gate */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "quality" ? null : "quality")}>
              Quality Gate ({qualityWarnings.length} warnings)
            </button>
            {activePanel === "quality" && (
              <div className="abp__panel-body">
                {qualityWarnings.length === 0 ? (
                  <p className="abp__panel-empty">All quality checks pass.</p>
                ) : (
                  <ul className="abp__warnings">
                    {qualityWarnings.map((w, i) => (
                      <li key={i} className="abp__warning">{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Internal Link Recommender */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "links" ? null : "links")}>
              Internal Links ({linkSuggestions.length} suggestions)
            </button>
            {activePanel === "links" && (
              <div className="abp__panel-body">
                {linkSuggestions.length === 0 ? (
                  <p className="abp__panel-empty">All published posts are already linked.</p>
                ) : (
                  <div className="abp__link-list">
                    {linkSuggestions.map((p) => (
                      <div key={p.slug} className="abp__link-item">
                        <span className="abp__link-title">{p.title}</span>
                        <span className="abp__link-slug">/{p.slug}</span>
                        <button className="btn btn--sm" onClick={() => insertInternalLink(p.slug, p.title)}>
                          Insert
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Structured Data Panel */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "schema" ? null : "schema")}>
              Structured Data
            </button>
            {activePanel === "schema" && (
              <div className="abp__panel-body">
                <div className="abp__schema-row">
                  <span>Article Schema:</span>
                  <span className={post.schemaJson ? "abp__check--pass" : "abp__check--fail"}>
                    {post.schemaJson ? "\u2713 Present" : "\u2717 Missing"}
                  </span>
                </div>
                <div className="abp__schema-row">
                  <span>FAQ Section:</span>
                  <span className={/^## FAQ/m.test(markdown) ? "abp__check--pass" : "abp__check--fail"}>
                    {/^## FAQ/m.test(markdown) ? "\u2713 Present" : "\u2717 Missing"}
                  </span>
                </div>
                <div className="abp__schema-row">
                  <span>OG Image:</span>
                  <span>{post.ogImageUrl ? "\u2713 Set" : "\u2717 Not set"}</span>
                </div>
                {post.ogImageUrl && (
                  <img src={post.ogImageUrl} alt="OG Preview" className="abp__og-preview" />
                )}
                <div className="abp__schema-row">
                  <span>Canonical URL:</span>
                  <span>{post.canonicalUrl || `/${post.slug}`}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content Freshness Tool */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "freshness" ? null : "freshness")}>
              Content Freshness
            </button>
            {activePanel === "freshness" && (
              <div className="abp__panel-body">
                <div className="abp__schema-row">
                  <span>Data last checked:</span>
                  <span>{markdown.match(/Data last checked:\s*(\w+ \d{4})/i)?.[1] || "Not found"}</span>
                </div>
                <div className="abp__schema-row">
                  <span>Published:</span>
                  <span>{fmtDate(post.publishedAt)}</span>
                </div>
                <div className="abp__schema-row">
                  <span>Last updated:</span>
                  <span>{fmtDate(post.updatedAt)}</span>
                </div>
                <div className="abp__schema-row">
                  <span>Revision:</span>
                  <span>#{post.revisionNumber}</span>
                </div>
                <p className="abp__hint">
                  To refresh cost data, re-run the SEO auto-fix or manually update the markdown. Republish to apply.
                </p>
              </div>
            )}
          </div>

          {/* Performance Intelligence */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "perf" ? null : "perf")}>
              Performance
            </button>
            {activePanel === "perf" && (
              <div className="abp__panel-body">
                <p className="abp__panel-empty">
                  Analytics integration coming soon. Connect Google Analytics or Search Console for page views, time on page, and bounce rate.
                </p>
                {/* TODO: stub for GA / Search Console data */}
              </div>
            )}
          </div>

          {/* Competitor Drift Scanner */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "drift" ? null : "drift")}>
              Competitor Drift
            </button>
            {activePanel === "drift" && (
              <div className="abp__panel-body">
                <p className="abp__panel-empty">
                  Monthly competitor heading comparisons coming soon. This will flag new topics competitors cover that this post does not.
                </p>
                {/* TODO: competitor drift implementation */}
              </div>
            )}
          </div>

          {/* Revision History */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "revisions" ? null : "revisions")}>
              Revisions ({post.revisions.length})
            </button>
            {activePanel === "revisions" && (
              <div className="abp__panel-body">
                {post.revisions.length === 0 ? (
                  <p className="abp__panel-empty">No previous revisions.</p>
                ) : (
                  <div className="abp__revision-list">
                    {post.revisions.map((r) => (
                      <div key={r.id} className="abp__revision-item">
                        <span className="abp__revision-num">Rev #{r.revisionNumber}</span>
                        <span className="abp__revision-date">{fmtDate(r.createdAt)}</span>
                        <span className="abp__revision-title">{r.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sources */}
          <div className="abp__panel">
            <button className="abp__panel-header" onClick={() => setActivePanel(activePanel === "sources" ? null : "sources")}>
              Sources ({post.sources.length})
            </button>
            {activePanel === "sources" && (
              <div className="abp__panel-body">
                <div className="cgen__sources-list">
                  {post.sources.map((source) => (
                    <div key={source.id} className="cgen__source-item">
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="cgen__source-url">
                        {source.title || source.url}
                      </a>
                      {source.publisher && <span className="cgen__source-pub">{source.publisher}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="abp__modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="abp__modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="abp__modal-title">Delete Post</h2>
            <p className="abp__modal-text">
              This will permanently delete <strong>{post.title}</strong> and all associated revisions, images, and sources.
            </p>
            <p className="abp__modal-text">
              Type the slug <code>{post.slug}</code> to confirm:
            </p>
            <input
              type="text"
              className="cgen__input"
              value={deleteSlug}
              onChange={(e) => setDeleteSlug(e.target.value)}
              placeholder={post.slug}
            />
            <div className="abp__modal-actions">
              <button className="btn btn--secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={handleDelete}
                disabled={deleting || deleteSlug !== post.slug}
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
