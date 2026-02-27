"use client";

import { useState } from "react";
import Link from "next/link";

interface AdminData {
  id: string;
  seoScore: number | null;
  confidence: string;
  revisionNumber: number;
  targetKeyword: string | null;
}

interface Props {
  slug: string;
  isAiPost: boolean;
  adminData: AdminData | null;
}

export default function AdminPostToolbarClient({
  slug,
  isAiPost,
  adminData,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [seoRunning, setSeoRunning] = useState(false);
  const [seoResult, setSeoResult] = useState<{
    score: number;
    issueCount: number;
  } | null>(null);

  async function runSeoCheck() {
    if (!adminData) return;
    setSeoRunning(true);
    setSeoResult(null);
    try {
      const res = await fetch(`/api/admin/blog/${adminData.id}/seo-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "SEO check failed");
      }
      const data = await res.json();
      setSeoResult({
        score: data.score,
        issueCount: (data.issues || []).length,
      });
    } catch (err) {
      console.error("SEO check failed:", err);
    } finally {
      setSeoRunning(false);
    }
  }

  if (collapsed) {
    return (
      <button
        className="admin-toolbar__toggle"
        onClick={() => setCollapsed(false)}
        title="Show admin toolbar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 4h12M2 8h12M2 12h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>Admin</span>
      </button>
    );
  }

  const seoScore = seoResult?.score ?? adminData?.seoScore ?? null;

  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar__row">
        {/* Left: badges */}
        <div className="admin-toolbar__badges">
          <span className="admin-toolbar__badge admin-toolbar__badge--admin">
            ADMIN
          </span>
          <span
            className={`admin-toolbar__badge admin-toolbar__badge--${
              isAiPost ? "ai" : "static"
            }`}
          >
            {isAiPost ? "AI Generated" : "Static Post"}
          </span>
          {adminData?.confidence === "LOW" && (
            <span className="admin-toolbar__badge admin-toolbar__badge--warn">
              LOW CONFIDENCE
            </span>
          )}
          {adminData && adminData.revisionNumber > 0 && (
            <span className="admin-toolbar__badge admin-toolbar__badge--neutral">
              Rev {adminData.revisionNumber}
            </span>
          )}
          {seoScore !== null && (
            <span
              className={`admin-toolbar__badge ${
                seoScore >= 80
                  ? "admin-toolbar__badge--good"
                  : seoScore >= 50
                  ? "admin-toolbar__badge--warn"
                  : "admin-toolbar__badge--bad"
              }`}
            >
              SEO: {seoScore}/100
              {seoResult && seoResult.issueCount > 0 && (
                <> &middot; {seoResult.issueCount} issue{seoResult.issueCount !== 1 ? "s" : ""}</>
              )}
            </span>
          )}
          {adminData?.targetKeyword && (
            <span className="admin-toolbar__badge admin-toolbar__badge--neutral">
              KW: {adminData.targetKeyword}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="admin-toolbar__actions">
          {isAiPost && adminData && (
            <>
              <button
                className="admin-toolbar__btn admin-toolbar__btn--seo"
                onClick={runSeoCheck}
                disabled={seoRunning}
              >
                {seoRunning ? "Checking…" : "Run SEO Check"}
              </button>
              <Link
                href={`/admin/blog/${adminData.id}`}
                className="admin-toolbar__btn admin-toolbar__btn--edit"
              >
                Edit in Admin
              </Link>
            </>
          )}
          <Link
            href="/admin/blog"
            className="admin-toolbar__btn admin-toolbar__btn--list"
          >
            All Posts
          </Link>
          <button
            className="admin-toolbar__btn admin-toolbar__btn--collapse"
            onClick={() => setCollapsed(true)}
            title="Hide toolbar"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
