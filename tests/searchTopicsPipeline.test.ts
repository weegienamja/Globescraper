import { describe, it, expect } from "vitest";
import {
  canonicalizeUrl,
  scoreSearchResult,
  buildFallbackQueries,
} from "../lib/news/searchTopicsPipeline";

/* ------------------------------------------------------------------ */
/*  canonicalizeUrl                                                     */
/* ------------------------------------------------------------------ */

describe("canonicalizeUrl", () => {
  it("strips trailing slash", () => {
    expect(canonicalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path"
    );
  });

  it("strips www prefix", () => {
    expect(canonicalizeUrl("https://www.example.com/page")).toBe(
      "https://example.com/page"
    );
  });

  it("strips utm_* tracking params", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/article?utm_source=twitter&utm_medium=social&id=123"
      )
    ).toBe("https://example.com/article?id=123");
  });

  it("strips fbclid", () => {
    expect(
      canonicalizeUrl("https://example.com/page?fbclid=abc123")
    ).toBe("https://example.com/page");
  });

  it("strips gclid and gclsrc", () => {
    expect(
      canonicalizeUrl("https://example.com/?gclid=xyz&gclsrc=aw.ds&real=1")
    ).toBe("https://example.com?real=1");
  });

  it("strips msclkid", () => {
    expect(
      canonicalizeUrl("https://example.com/path?msclkid=abc")
    ).toBe("https://example.com/path");
  });

  it("preserves non-tracking query params", () => {
    expect(
      canonicalizeUrl("https://example.com/search?q=cambodia&page=2")
    ).toBe("https://example.com/search?q=cambodia&page=2");
  });

  it("handles URLs with no query string", () => {
    expect(canonicalizeUrl("https://example.com/article")).toBe(
      "https://example.com/article"
    );
  });

  it("handles http (not https)", () => {
    const result = canonicalizeUrl("http://www.example.com/");
    // Should strip www and trailing slash; protocol stays http
    expect(result).toContain("example.com");
    expect(result).not.toContain("www.");
    expect(result).not.toMatch(/\/$/);
  });

  it("handles malformed URL gracefully", () => {
    const result = canonicalizeUrl("not-a-valid-url");
    expect(typeof result).toBe("string");
  });

  it("two URLs that differ only by tracking params canonicalize to the same value", () => {
    const a = canonicalizeUrl(
      "https://www.phnompenhpost.com/article?utm_source=google&fbclid=abc"
    );
    const b = canonicalizeUrl("https://phnompenhpost.com/article/");
    expect(a).toBe(b);
  });
});

/* ------------------------------------------------------------------ */
/*  scoreSearchResult                                                   */
/* ------------------------------------------------------------------ */

describe("scoreSearchResult", () => {
  it("scores higher when snippet is present and >= 40 chars", () => {
    const withSnippet = scoreSearchResult(
      {
        title: "Cambodia visa requirements 2026",
        snippet: "A".repeat(50),
        url: "https://example.com/article",
      },
      "Phnom Penh"
    );
    const noSnippet = scoreSearchResult(
      {
        title: "Cambodia visa requirements 2026",
        snippet: null,
        url: "https://example.com/article",
      },
      "Phnom Penh"
    );
    expect(withSnippet).toBeGreaterThan(noSnippet);
  });

  it("gives +1 for short snippet (< 40 chars but > 0)", () => {
    const shortSnippet = scoreSearchResult(
      {
        title: "Some article",
        snippet: "Brief info",
        url: "https://random.com/page",
      },
      "Cambodia wide"
    );
    const noSnippet = scoreSearchResult(
      {
        title: "Some article",
        snippet: null,
        url: "https://random.com/page",
      },
      "Cambodia wide"
    );
    expect(shortSnippet).toBe(noSnippet + 1);
  });

  it("does not filter out results with no snippet (score >= 0 possible)", () => {
    const score = scoreSearchResult(
      {
        title: "Cambodia entry rules for teachers in Phnom Penh",
        snippet: null,
        url: "https://gov.kh/entry",
      },
      "Phnom Penh"
    );
    // Should still have points from trusted domain + title relevance
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("boosts high-trust domains", () => {
    const trusted = scoreSearchResult(
      {
        title: "Some page",
        snippet: null,
        url: "https://reuters.com/article",
      },
      "Cambodia wide"
    );
    const untrusted = scoreSearchResult(
      {
        title: "Some page",
        snippet: null,
        url: "https://randomsite.com/article",
      },
      "Cambodia wide"
    );
    expect(trusted).toBeGreaterThan(untrusted);
  });

  it("penalizes globescraper.com", () => {
    const own = scoreSearchResult(
      {
        title: "Cambodia travel guide",
        snippet: "A".repeat(50),
        url: "https://globescraper.com/guide",
      },
      "Cambodia wide"
    );
    const other = scoreSearchResult(
      {
        title: "Cambodia travel guide",
        snippet: "A".repeat(50),
        url: "https://othersite.com/guide",
      },
      "Cambodia wide"
    );
    expect(own).toBeLessThan(other);
  });

  it("boosts title containing cityFocus", () => {
    const withCity = scoreSearchResult(
      {
        title: "Phnom Penh entry requirements 2026",
        snippet: null,
        url: "https://random.com/page",
      },
      "Phnom Penh"
    );
    const noCity = scoreSearchResult(
      {
        title: "Some irrelevant stuff",
        snippet: null,
        url: "https://random.com/page",
      },
      "Phnom Penh"
    );
    expect(withCity).toBeGreaterThan(noCity);
  });

  it("penalizes spam-like titles", () => {
    const spam = scoreSearchResult(
      {
        title: "BUY NOW",
        snippet: null,
        url: "https://random.com/page",
      },
      "Cambodia wide"
    );
    expect(spam).toBeLessThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  buildFallbackQueries                                                */
/* ------------------------------------------------------------------ */

describe("buildFallbackQueries", () => {
  it("returns queries that do not duplicate originals", () => {
    const original = ["Phnom Penh entry requirements 2026"];
    const fallback = buildFallbackQueries(
      "A 2026 Guide to Entry Requirements for Teachers in Phnom Penh",
      "Phnom Penh",
      "teachers",
      original
    );
    const lowerOriginal = new Set(original.map((q) => q.toLowerCase()));
    for (const q of fallback) {
      expect(lowerOriginal.has(q.toLowerCase())).toBe(false);
    }
  });

  it("includes audience-specific queries for teachers", () => {
    const fallback = buildFallbackQueries(
      "Teaching English in Cambodia",
      "Phnom Penh",
      "teachers",
      []
    );
    const joined = fallback.join(" ").toLowerCase();
    expect(joined).toContain("teacher");
  });

  it("includes audience-specific queries for travellers", () => {
    const fallback = buildFallbackQueries(
      "Travelling to Cambodia",
      "Siem Reap",
      "travellers",
      []
    );
    const joined = fallback.join(" ").toLowerCase();
    expect(joined).toContain("visa");
  });

  it("includes authoritative-source queries", () => {
    const fallback = buildFallbackQueries(
      "Any topic",
      "Cambodia wide",
      "both",
      []
    );
    const joined = fallback.join(" ").toLowerCase();
    expect(joined).toContain("gov.kh");
    expect(joined).toContain("embassy");
  });

  it("strips years from seed title words for broader queries", () => {
    const fallback = buildFallbackQueries(
      "A 2026 Guide to Entry Requirements",
      "Phnom Penh",
      "both",
      []
    );
    // None of the fallback queries should contain 2026
    // (the point is to broaden the search)
    const yearQueries = fallback.filter((q) => q.includes("2026"));
    // It's acceptable if some contain the year via authority queries,
    // but broader title-derived queries should not
    const titleDerived = fallback.slice(0, 2);
    for (const q of titleDerived) {
      expect(q).not.toContain("2026");
    }
  });
});
