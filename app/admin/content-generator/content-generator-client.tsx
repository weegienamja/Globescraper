"use client";

import { useState } from "react";
import Link from "next/link";

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
}

export default function ContentGeneratorClient() {
  const [city, setCity] = useState<string>(CITIES[0]);
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [targetKeyword, setTargetKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [wordCount, setWordCount] = useState<number>(1200);
  const [state, setState] = useState<GenerationState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  async function handleGenerate() {
    setState("generating");
    setError("");
    setResult(null);
    setPublished(false);
    setProgress(0);

    // Simulate progress stages
    const stages = [
      { pct: 10, label: "Preparing search queries..." },
      { pct: 25, label: "Discovering sources..." },
      { pct: 40, label: "Fetching and extracting content..." },
      { pct: 55, label: "Building facts pack..." },
      { pct: 70, label: "Generating article with Gemini..." },
      { pct: 85, label: "Validating and saving draft..." },
    ];

    let stageIndex = 0;
    const interval = setInterval(() => {
      if (stageIndex < stages.length) {
        setProgress(stages[stageIndex].pct);
        setProgressLabel(stages[stageIndex].label);
        stageIndex++;
      }
    }, 2000);

    try {
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
        }),
      });

      clearInterval(interval);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Generation failed.");
      }

      setProgress(100);
      setProgressLabel("Draft saved successfully!");
      setState("success");
      setResult(data);
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
        const data = await res.json();
        throw new Error(data.error || "Publish failed.");
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
    </div>
  );
}
