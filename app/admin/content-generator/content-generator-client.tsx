"use client";

import { useState } from "react";
import Link from "next/link";

/** Safely parse a fetch response as JSON; falls back to a clear error message. */
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Vercel/infra errors often return plain text like "An error occurred..."
    throw new Error(text.slice(0, 300) || `Server returned ${res.status} with no body`);
  }
}

const CITIES = ["Phnom Penh", "Siem Reap"] as const;

const TOPICS = [
  "Cost of living",
  "Renting and neighbourhoods",
  "Visas",
  "Safety and scams",
  "Healthcare",
  "Transport",
  "SIM cards and banking",
  "Daily life",
  "Teaching market",
] as const;

const AUDIENCES = [
  "New teacher",
  "Long-term expat",
  "Digital nomad",
  "Couple relocating",
  "Solo traveller",
] as const;

const WORD_COUNTS = [800, 1200, 1800] as const;

type GenerationState = "idle" | "generating" | "success" | "error";

interface GenerationResult {
  draftId: string;
  title: string;
  slug: string;
  confidence: "HIGH" | "LOW";
  sourceCount: number;
  imageCount?: number;
  competitorCount?: number;
}

/* ── News generator types ── */

type NewsSearchState = "idle" | "searching" | "done" | "error";
type NewsGenState = "idle" | "generating" | "success" | "error";

interface NewsTopic {
  id: string;
  title: string;
  angle: string;
  whyItMatters: string;
  audienceFit: string[];
  suggestedKeywords: { target: string; secondary: string[] };
  searchQueries: string[];
  intent: string;
  outlineAngles: string[];
  fromSeedTitle?: boolean;
  sourceUrls?: string[];
  sourceCount?: number;
  /* Legacy fields (only present when USE_EXTERNAL_SOURCES is true) */
  freshnessScore?: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
}

interface NewsGenResult {
  draftId: string;
  title: string;
  slug: string;
  confidence: "HIGH" | "LOW";
  sourceCount: number;
  imageCount: number;
}

const NEWS_CITY_OPTIONS = ["Cambodia wide", "Phnom Penh", "Siem Reap"] as const;
const NEWS_AUDIENCE_OPTIONS = ["both", "travellers", "teachers"] as const;

const NEWS_PROGRESS_STAGES = [
  { pct: 8, label: "Discovering sources..." },
  { pct: 18, label: "Fetching and extracting..." },
  { pct: 30, label: "Building facts pack..." },
  { pct: 42, label: "Outlining and choosing angle..." },
  { pct: 55, label: "Writing draft..." },
  { pct: 67, label: "Running humanization pass..." },
  { pct: 77, label: "Generating images..." },
  { pct: 87, label: "Uploading images..." },
  { pct: 95, label: "Saving draft..." },
];

export default function ContentGeneratorClient() {
  const [city, setCity] = useState<string>(CITIES[0]);
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [targetKeyword, setTargetKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [wordCount, setWordCount] = useState<number>(1200);
  const [competitorUrls, setCompetitorUrls] = useState("");
  const [state, setState] = useState<GenerationState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  /* ── News generator state ── */
  const [newsCityFocus, setNewsCityFocus] = useState<string>("Cambodia wide");
  const [newsAudienceFocus, setNewsAudienceFocus] = useState<string>("both");
  const [newsSearchState, setNewsSearchState] = useState<NewsSearchState>("idle");
  const [newsTopics, setNewsTopics] = useState<NewsTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [newsGenState, setNewsGenState] = useState<NewsGenState>("idle");
  const [newsProgress, setNewsProgress] = useState(0);
  const [newsProgressLabel, setNewsProgressLabel] = useState("");
  const [newsError, setNewsError] = useState("");
  const [newsResult, setNewsResult] = useState<NewsGenResult | null>(null);
  const [newsSearchError, setNewsSearchError] = useState("");

  /* ── Generated Title state ── */
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [titleGenState, setTitleGenState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [titleGenStatus, setTitleGenStatus] = useState("");
  const [titleKeywords, setTitleKeywords] = useState<string[]>([]);

  /* ── News: generate title ── */
  async function handleGenerateTitle() {
    setTitleGenState("generating");
    setTitleGenStatus("");
    setTitleKeywords([]);

    try {
      const res = await fetch("/api/admin/content-generator/news/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityFocus: newsCityFocus,
          audienceFocus: newsAudienceFocus,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || "Title generation failed.");

      setGeneratedTitle((data.title as string) || "");
      setTitleKeywords((data.keywords as string[]) || []);
      setTitleGenStatus("Based on your existing posts and current Cambodia interest.");
      setTitleGenState("done");
    } catch (err) {
      setTitleGenState("error");
      setTitleGenStatus(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  }

  /* ── News: search topics ── */
  async function handleNewsSearch() {
    setNewsSearchState("searching");
    setNewsSearchError("");
    setNewsTopics([]);
    setSelectedTopicId(null);
    setNewsGenState("idle");
    setNewsResult(null);
    setNewsError("");

    try {
      const res = await fetch("/api/admin/content-generator/news/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityFocus: newsCityFocus,
          audienceFocus: newsAudienceFocus,
          ...(generatedTitle.trim() ? { seedTitle: generatedTitle.trim() } : {}),
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || "Search failed.");

      setNewsTopics((data.topics as NewsTopic[]) || []);
      setNewsSearchState("done");

      if (((data.topics as unknown[]) || []).length === 0) {
        setNewsSearchError((data.message as string) || "No topics found. Try adjusting filters or try again later.");
      }
    } catch (err) {
      setNewsSearchState("error");
      setNewsSearchError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  }

  /* ── News: generate draft ── */
  async function handleNewsGenerate() {
    const topic = newsTopics.find((t) => t.id === selectedTopicId);
    if (!topic) return;

    setNewsGenState("generating");
    setNewsError("");
    setNewsResult(null);
    setNewsProgress(0);
    setNewsProgressLabel("");

    let stageIndex = 0;
    const interval = setInterval(() => {
      if (stageIndex < NEWS_PROGRESS_STAGES.length) {
        setNewsProgress(NEWS_PROGRESS_STAGES[stageIndex].pct);
        setNewsProgressLabel(NEWS_PROGRESS_STAGES[stageIndex].label);
        stageIndex++;
      }
    }, 4000);

    try {
      const res = await fetch("/api/admin/content-generator/news/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: topic.id,
          topicTitle: topic.title,
          angle: topic.angle,
          audienceFit: topic.audienceFit,
          targetKeyword: topic.suggestedKeywords.target,
          secondaryKeywords: topic.suggestedKeywords.secondary,
          seedSourceUrls: topic.sourceUrls || [],
        }),
      });

      clearInterval(interval);
      const data = await safeJson(res);

      if (!res.ok) throw new Error((data.error as string) || "Generation failed.");

      setNewsProgress(100);
      setNewsProgressLabel("Draft saved successfully!");
      setNewsGenState("success");
      setNewsResult({
        draftId: data.draftId as string,
        title: (data.title as string) || topic.title,
        slug: (data.slug as string) || "",
        confidence: (data.confidence as "HIGH" | "LOW") || "HIGH",
        sourceCount: (data.sourceCount as number) || 0,
        imageCount: (data.imageCount as number) || 0,
      });
    } catch (err) {
      clearInterval(interval);
      setNewsProgress(0);
      setNewsGenState("error");
      setNewsError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  }

  /* ── News: reset ── */
  function handleNewsReset() {
    setNewsSearchState("idle");
    setNewsTopics([]);
    setSelectedTopicId(null);
    setNewsGenState("idle");
    setNewsProgress(0);
    setNewsProgressLabel("");
    setNewsError("");
    setNewsSearchError("");
    setNewsResult(null);
    setGeneratedTitle("");
    setTitleGenState("idle");
    setTitleGenStatus("");
    setTitleKeywords([]);
  }

  async function handleGenerate() {
    setState("generating");
    setError("");
    setResult(null);
    setPublished(false);
    setProgress(0);

    // Simulate progress stages
    const stages = [
      { pct: 7, label: "Preparing search queries..." },
      { pct: 15, label: "Discovering sources..." },
      { pct: 23, label: "Fetching and extracting content..." },
      { pct: 31, label: "Auto-discovering competitors..." },
      { pct: 39, label: "Checking existing content for uniqueness..." },
      { pct: 47, label: "Building facts pack..." },
      { pct: 57, label: "Generating article with Gemini..." },
      { pct: 67, label: "Running humanization pass..." },
      { pct: 77, label: "Generating images with Imagen 3..." },
      { pct: 87, label: "Uploading images to storage..." },
      { pct: 95, label: "Saving draft..." },
    ];

    let stageIndex = 0;
    const interval = setInterval(() => {
      if (stageIndex < stages.length) {
        setProgress(stages[stageIndex].pct);
        setProgressLabel(stages[stageIndex].label);
        stageIndex++;
      }
    }, 3000);

    try {
      // Parse competitor URLs (one per line, up to 3)
      const parsedCompetitorUrls = competitorUrls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0)
        .slice(0, 3);

      const res = await fetch("/api/admin/content-generator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          topic,
          audience,
          targetKeyword: targetKeyword || undefined,
          secondaryKeywords: secondaryKeywords || undefined,
          wordCount,
          competitorUrls: parsedCompetitorUrls.length > 0 ? parsedCompetitorUrls : undefined,
        }),
      });

      clearInterval(interval);

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data.error as string) || "Generation failed.");
      }

      setProgress(100);
      setProgressLabel("Draft saved successfully!");
      setState("success");
      setResult(data as unknown as GenerationResult);
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      setState("error");
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
  }

  async function handlePublish() {
    if (!result) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/content-generator/drafts/${result.draftId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error((data.error as string) || "Publish failed.");
      }
      setPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  function handleReset() {
    setState("idle");
    setError("");
    setResult(null);
    setProgress(0);
    setProgressLabel("");
    setPublished(false);
  }

  return (
    <div className="cgen">
      <div className="cgen__header">
        <h1 className="cgen__title">AI Blog Generator</h1>
        <div className="cgen__nav">
          <Link href="/admin" className="cgen__back-link">
            Back to Admin
          </Link>
          <Link href="/admin/content-generator/drafts" className="btn btn--secondary">
            View Drafts
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="cgen__form-card">
        <div className="cgen__form-grid">
          {/* City */}
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="cgen-city">
              City
            </label>
            <select
              id="cgen-city"
              className="cgen__select"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={state === "generating"}
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="cgen-topic">
              Topic
            </label>
            <select
              id="cgen-topic"
              className="cgen__select"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={state === "generating"}
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Audience */}
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="cgen-audience">
              Audience
            </label>
            <select
              id="cgen-audience"
              className="cgen__select"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={state === "generating"}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Word Count */}
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="cgen-wordcount">
              Article Length
            </label>
            <select
              id="cgen-wordcount"
              className="cgen__select"
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              disabled={state === "generating"}
            >
              {WORD_COUNTS.map((w) => (
                <option key={w} value={w}>
                  {w} words
                </option>
              ))}
            </select>
          </div>

          {/* Target Keyword */}
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="cgen-keyword">
              Target Keyword (optional)
            </label>
            <input
              id="cgen-keyword"
              type="text"
              className="cgen__input"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g. cost of living Phnom Penh"
              disabled={state === "generating"}
            />
          </div>

          {/* Secondary Keywords */}
          <div className="cgen__field">
            <label className="cgen__label" htmlFor="cgen-secondary">
              Secondary Keywords (optional)
            </label>
            <input
              id="cgen-secondary"
              type="text"
              className="cgen__input"
              value={secondaryKeywords}
              onChange={(e) => setSecondaryKeywords(e.target.value)}
              placeholder="e.g. budget, rent, food prices"
              disabled={state === "generating"}
            />
          </div>

          {/* Competitor URLs */}
          <div className="cgen__field cgen__field--full">
            <label className="cgen__label" htmlFor="cgen-competitors">
              Extra Competitor URLs (optional, one per line)
            </label>
            <textarea
              id="cgen-competitors"
              className="cgen__input cgen__textarea"
              value={competitorUrls}
              onChange={(e) => setCompetitorUrls(e.target.value)}
              placeholder={"https://example.com/cost-of-living-cambodia\nhttps://example.com/phnom-penh-guide"}
              disabled={state === "generating"}
              rows={3}
            />
            <span className="cgen__hint">
              Competitors are auto-discovered from Google and known expat sites. Add extra URLs here if you want specific articles included in the gap analysis. Existing GlobeScraper articles are automatically checked to avoid duplication.
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="cgen__actions">
          <button
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={state === "generating"}
          >
            {state === "generating" ? "Generating..." : "Generate Draft"}
          </button>
          {(state === "success" || state === "error") && (
            <button className="btn btn--secondary" onClick={handleReset}>
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {state === "generating" && (
        <div className="cgen__progress-section">
          <div className="cgen__progress-bar-bg">
            <div
              className="cgen__progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="cgen__progress-info">
            <span className="cgen__progress-pct">{progress}%</span>
            <span className="cgen__progress-label">{progressLabel}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {state === "error" && error && (
        <div className="cgen__alert cgen__alert--error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Success Result Card */}
      {state === "success" && result && (
        <div className={`cgen__result-card ${published ? "cgen__result-card--published" : ""}`}>
          <div className="cgen__result-header">
            <span className={`cgen__badge cgen__badge--${published ? "published" : "draft"}`}>
              {published ? "PUBLISHED" : "DRAFT"}
            </span>
            {result.confidence === "LOW" && (
              <span className="cgen__badge cgen__badge--low">LOW CONFIDENCE</span>
            )}
          </div>
          <h2 className="cgen__result-title">{result.title}</h2>
          <div className="cgen__result-meta">
            <span>Sources used: {result.sourceCount}</span>
            {(result.imageCount ?? 0) > 0 && <span>Images: {result.imageCount}</span>}
            {(result.competitorCount ?? 0) > 0 && <span>Competitors analyzed: {result.competitorCount}</span>}
            <span>Slug: /{result.slug}</span>
          </div>
          <div className="cgen__result-actions">
            <Link
              href={`/admin/content-generator/drafts/${result.draftId}`}
              className="btn btn--secondary"
            >
              Preview and Edit
            </Link>
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
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* Cambodia News Blog Generator Card                           */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="cgen__news-card">
        <div className="cgen__news-header">
          <h2 className="cgen__news-title">Cambodia News Blog Generator</h2>
          <p className="cgen__news-desc">
            Find a timely Cambodia topic, pick one, generate a draft with sources and images.
          </p>
        </div>

        {/* A) Controls */}
        <div className="cgen__news-controls">
          <div className="cgen__news-filters">
            <div className="cgen__field">
              <label className="cgen__label" htmlFor="news-city">
                City Focus
              </label>
              <select
                id="news-city"
                className="cgen__select"
                value={newsCityFocus}
                onChange={(e) => setNewsCityFocus(e.target.value)}
                disabled={newsSearchState === "searching" || newsGenState === "generating"}
              >
                {NEWS_CITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="cgen__field">
              <label className="cgen__label" htmlFor="news-audience">
                Audience Focus
              </label>
              <select
                id="news-audience"
                className="cgen__select"
                value={newsAudienceFocus}
                onChange={(e) => setNewsAudienceFocus(e.target.value)}
                disabled={newsSearchState === "searching" || newsGenState === "generating"}
              >
                {NEWS_AUDIENCE_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generated Title field group */}
          <div className="cgen__news-title-group">
            <div className="cgen__field cgen__field--full">
              <label className="cgen__label" htmlFor="news-generated-title">
                Generated Title
              </label>
              <div className="cgen__news-title-row">
                <input
                  id="news-generated-title"
                  type="text"
                  className="cgen__input"
                  value={generatedTitle}
                  onChange={(e) => setGeneratedTitle(e.target.value)}
                  placeholder="Click Generate Title to get an SEO opportunity topic…"
                  disabled={newsSearchState === "searching" || newsGenState === "generating" || titleGenState === "generating"}
                />
                <button
                  className="btn btn--secondary"
                  onClick={handleGenerateTitle}
                  disabled={titleGenState === "generating" || newsSearchState === "searching" || newsGenState === "generating"}
                >
                  {titleGenState === "generating" ? "Generating..." : "Generate Title"}
                </button>
              </div>
              {titleGenStatus && (
                <span className={`cgen__hint ${titleGenState === "error" ? "cgen__hint--error" : ""}`}>
                  {titleGenStatus}
                </span>
              )}
              {titleKeywords.length > 0 && (
                <div className="cgen__news-keyword-chips">
                  {titleKeywords.map((kw) => (
                    <span key={kw} className="cgen__chip cgen__chip--keyword">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="cgen__actions">
            <button
              className="btn btn--primary"
              onClick={handleNewsSearch}
              disabled={newsSearchState === "searching" || newsGenState === "generating"}
            >
              {newsSearchState === "searching" ? "Searching..." : "Search Topics"}
            </button>
            <button
              className="btn btn--primary"
              onClick={handleNewsGenerate}
              disabled={!selectedTopicId || newsGenState === "generating" || newsSearchState === "searching"}
            >
              {newsGenState === "generating" ? "Generating..." : "Generate Draft"}
            </button>
            {(newsSearchState === "done" || newsSearchState === "error" || newsGenState === "success" || newsGenState === "error") && (
              <button className="btn btn--secondary" onClick={handleNewsReset}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* B) Topic results list */}
        {newsSearchState === "searching" && (
          <div className="cgen__news-loading">
            <div className="cgen__news-spinner" />
            <span>Discovering timely Cambodia topics...</span>
          </div>
        )}

        {newsSearchError && (
          <div className="cgen__alert cgen__alert--error">
            <strong>Error:</strong> {newsSearchError}
          </div>
        )}

        {newsTopics.length > 0 && (
          <div className="cgen__news-topics">
            <h3 className="cgen__news-topics-heading">
              {newsTopics.length} topic{newsTopics.length !== 1 ? "s" : ""} found
            </h3>
            <ul className="cgen__news-topic-list">
              {newsTopics.map((t) => (
                <li
                  key={t.id}
                  className={`cgen__news-topic-item ${selectedTopicId === t.id ? "cgen__news-topic-item--selected" : ""}`}
                  onClick={() => {
                    if (newsGenState !== "generating") setSelectedTopicId(t.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (newsGenState !== "generating") setSelectedTopicId(t.id);
                    }
                  }}
                >
                  <div className="cgen__news-topic-top">
                    <span className="cgen__news-topic-title">{t.title}</span>
                    <div className="cgen__news-topic-badges">
                      {t.fromSeedTitle && (
                        <span className="cgen__chip cgen__chip--seed">From generated title</span>
                      )}
                      {(t.sourceUrls?.length ?? 0) > 0 && (
                        <span className="cgen__badge cgen__badge--confidence-high" title="Grounded source URLs">
                          {t.sourceUrls!.length} source{t.sourceUrls!.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="cgen__badge cgen__badge--confidence-med" title="Search queries">
                        {t.searchQueries?.length ?? 0} queries
                      </span>
                      <span className="cgen__badge cgen__badge--confidence-med" title="Outline depth">
                        {t.outlineAngles?.length ?? 0} angles
                      </span>
                    </div>
                  </div>
                  <p className="cgen__news-topic-angle">{t.angle}</p>
                  <p className="cgen__news-topic-why">{t.whyItMatters}</p>
                  {t.intent && (
                    <p className="cgen__news-topic-intent"><strong>Intent:</strong> {t.intent}</p>
                  )}
                  <div className="cgen__news-topic-meta">
                    <span>{t.audienceFit.join(", ")}</span>
                    <span className="cgen__news-topic-keyword">{t.suggestedKeywords.target}</span>
                  </div>
                  {t.suggestedKeywords.secondary.length > 0 && (
                    <div className="cgen__news-keyword-chips">
                      {t.suggestedKeywords.secondary.slice(0, 5).map((kw) => (
                        <span key={kw} className="cgen__chip cgen__chip--keyword">{kw}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* C) Progress */}
        {newsGenState === "generating" && (
          <div className="cgen__progress-section">
            <div className="cgen__progress-bar-bg">
              <div
                className="cgen__progress-bar-fill"
                style={{ width: `${newsProgress}%` }}
              />
            </div>
            <div className="cgen__progress-info">
              <span className="cgen__progress-pct">{newsProgress}%</span>
              <span className="cgen__progress-label">{newsProgressLabel}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {newsGenState === "error" && newsError && (
          <div className="cgen__alert cgen__alert--error">
            <strong>Error:</strong> {newsError}
          </div>
        )}

        {/* D) Result */}
        {newsGenState === "success" && newsResult && (
          <div className="cgen__result-card">
            <div className="cgen__result-header">
              <span className="cgen__badge cgen__badge--draft">DRAFT</span>
              {newsResult.confidence === "LOW" && (
                <span className="cgen__badge cgen__badge--low">LOW CONFIDENCE</span>
              )}
            </div>
            <h2 className="cgen__result-title">{newsResult.title}</h2>
            <div className="cgen__result-meta">
              <span>Confidence: {newsResult.confidence}</span>
              {newsResult.imageCount > 0 && <span>Images: {newsResult.imageCount}</span>}
            </div>
            <div className="cgen__result-actions">
              <Link
                href={`/admin/content-generator/drafts/${newsResult.draftId}`}
                className="btn btn--secondary"
              >
                View Draft
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
