import { describe, it, expect } from "vitest";
import {
  canonicalizeUrl,
  scoreSearchResult,
  buildSearchQueryPack,
  extractTitleKeywords,
  inferTopicFromTitle,
  buildFallbackRound,
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
/*  extractTitleKeywords                                                */
/* ------------------------------------------------------------------ */

describe("extractTitleKeywords", () => {
  it("strips noise words like guide, essential, tips", () => {
    const kws = extractTitleKeywords(
      "Essential Guide to Living in Phnom Penh"
    );
    expect(kws).not.toContain("essential");
    expect(kws).not.toContain("guide");
    expect(kws).not.toContain("living");
    expect(kws).not.toContain("phnom");
    expect(kws).not.toContain("penh");
  });

  it("strips years", () => {
    const kws = extractTitleKeywords("2026 Visa Requirements for Cambodia");
    expect(kws.join(" ")).not.toContain("2026");
  });

  it("returns at most 3 keywords", () => {
    const kws = extractTitleKeywords(
      "Visa Entry Immigration Border Requirements for Arriving in Cambodia"
    );
    expect(kws.length).toBeLessThanOrEqual(3);
  });

  it("returns meaningful words from typical title", () => {
    const kws = extractTitleKeywords(
      "Avoiding Taxi Scams at Phnom Penh Airport"
    );
    expect(kws.length).toBeGreaterThan(0);
    const joined = kws.join(" ");
    // Should keep meaningful words like "avoiding", "taxi", "scams", "airport"
    expect(joined).toMatch(/taxi|scam|airport|avoiding/i);
  });

  it("returns empty array for all-noise title", () => {
    const kws = extractTitleKeywords("The Essential Guide to Cambodia");
    // "essential", "guide", "cambodia" all filtered
    expect(kws.length).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  inferTopicFromTitle                                                 */
/* ------------------------------------------------------------------ */

describe("inferTopicFromTitle", () => {
  it("infers visa from visa-related title", () => {
    expect(inferTopicFromTitle("Cambodia E-Visa Guide 2026")).toBe("visa");
  });

  it("infers scams from scam-related title", () => {
    expect(inferTopicFromTitle("Common Scams in Phnom Penh")).toBe("scams");
  });

  it("infers teaching from TEFL title", () => {
    expect(inferTopicFromTitle("TEFL Jobs in Cambodia")).toBe("teaching");
  });

  it("infers renting from housing title", () => {
    expect(inferTopicFromTitle("Renting an Apartment in Phnom Penh")).toBe(
      "renting"
    );
  });

  it("falls back to travel for unrecognized title", () => {
    expect(inferTopicFromTitle("Random Thoughts About Life")).toBe("travel");
  });

  it("matches multi-word keywords like cost of living", () => {
    expect(
      inferTopicFromTitle("Cost of Living in Phnom Penh 2026")
    ).toBe("cost of living");
  });
});

/* ------------------------------------------------------------------ */
/*  buildSearchQueryPack                                                */
/* ------------------------------------------------------------------ */

describe("buildSearchQueryPack", () => {
  it("returns base, authority, broad, and titleHint groups", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Phnom Penh",
      audienceFocus: "teachers",
      selectedGapTopic: "visa",
      primaryKeywordPhrase: "visa Cambodia Phnom Penh",
      currentYear: 2026,
      titleHint: "Visa Requirements for Teachers in Phnom Penh 2026",
    });

    expect(pack.strategy.base.length).toBeGreaterThanOrEqual(2);
    expect(pack.strategy.authority.length).toBeGreaterThanOrEqual(1);
    expect(pack.strategy.broad.length).toBeGreaterThanOrEqual(1);
    expect(pack.queries.length).toBe(
      pack.strategy.base.length +
        pack.strategy.authority.length +
        pack.strategy.broad.length +
        pack.strategy.titleHint.length
    );
  });

  it("base queries include keyword and city", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Phnom Penh",
      audienceFocus: "both",
      selectedGapTopic: "scams",
      primaryKeywordPhrase: "tourist scams Phnom Penh",
      currentYear: 2026,
    });

    const baseJoined = pack.strategy.base.join(" ").toLowerCase();
    expect(baseJoined).toContain("phnom penh");
    expect(baseJoined).toContain("scams");
  });

  it("authority queries use topic-specific templates", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Phnom Penh",
      audienceFocus: "travellers",
      selectedGapTopic: "safety",
      currentYear: 2026,
    });

    const authJoined = pack.strategy.authority.join(" ").toLowerCase();
    expect(authJoined).toContain("fcdo");
  });

  it("broad queries ignore audience", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Siem Reap",
      audienceFocus: "teachers",
      selectedGapTopic: "renting",
      currentYear: 2026,
    });

    const broadJoined = pack.strategy.broad.join(" ").toLowerCase();
    expect(broadJoined).toContain("foreigners");
    expect(broadJoined).not.toContain("teachers");
  });

  it("titleHint query is derived from title keywords, not full title", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Phnom Penh",
      audienceFocus: "both",
      selectedGapTopic: "visa",
      currentYear: 2026,
      titleHint: "Essential 2026 Visa Requirements for Teachers in Phnom Penh",
    });

    // titleHint should not be the full title
    if (pack.strategy.titleHint.length > 0) {
      const hint = pack.strategy.titleHint[0];
      expect(hint.length).toBeLessThan(
        "Essential 2026 Visa Requirements for Teachers in Phnom Penh".length
      );
      // Should not contain noise words
      expect(hint.toLowerCase()).not.toContain("essential");
    }
  });

  it("skips titleHint for all-noise titles", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Cambodia wide",
      audienceFocus: "both",
      selectedGapTopic: "travel",
      currentYear: 2026,
      titleHint: "The Essential Guide to Cambodia",
    });

    expect(pack.strategy.titleHint.length).toBe(0);
  });

  it("works without selectedGapTopic by inferring from title", () => {
    const pack = buildSearchQueryPack({
      cityFocus: "Phnom Penh",
      audienceFocus: "teachers",
      currentYear: 2026,
      titleHint: "TEFL Jobs in Phnom Penh",
    });

    // Should infer "teaching" topic
    const allJoined = pack.queries.join(" ").toLowerCase();
    expect(allJoined).toContain("teaching");
  });

  it("adds extra base query when city is not Cambodia", () => {
    const packCity = buildSearchQueryPack({
      cityFocus: "Phnom Penh",
      audienceFocus: "both",
      selectedGapTopic: "visa",
      currentYear: 2026,
    });
    const packWide = buildSearchQueryPack({
      cityFocus: "Cambodia wide",
      audienceFocus: "both",
      selectedGapTopic: "visa",
      currentYear: 2026,
    });

    // City-specific pack should have an extra "topic Cambodia city" base query
    expect(packCity.strategy.base.length).toBe(packWide.strategy.base.length + 1);
  });
});

/* ------------------------------------------------------------------ */
/*  buildFallbackRound                                                  */
/* ------------------------------------------------------------------ */

describe("buildFallbackRound", () => {
  it("round 1 replaces teachers with expats", () => {
    const queries = buildFallbackRound(1, "visa", "Phnom Penh", "teachers", []);
    const joined = queries.join(" ").toLowerCase();
    expect(joined).toContain("expats");
    expect(joined).not.toContain("teachers");
  });

  it("round 1 replaces travellers with visitors", () => {
    const queries = buildFallbackRound(
      1,
      "scams",
      "Siem Reap",
      "travellers",
      []
    );
    const joined = queries.join(" ").toLowerCase();
    expect(joined).toContain("visitors");
    expect(joined).not.toContain("travellers");
  });

  it("round 2 strips adjectives from topic", () => {
    const queries = buildFallbackRound(
      2,
      "essential safety",
      "Phnom Penh",
      "both",
      []
    );
    const joined = queries.join(" ").toLowerCase();
    expect(joined).not.toContain("essential");
    expect(joined).toContain("safety");
  });

  it("round 3 uses generic Cambodia queries without city", () => {
    const queries = buildFallbackRound(3, "visa", "Phnom Penh", "both", []);
    const joined = queries.join(" ").toLowerCase();
    expect(joined).toContain("cambodia");
    // Should not reference specific city in generic fallback
    for (const q of queries) {
      expect(q.toLowerCase()).not.toContain("phnom penh");
    }
  });

  it("deduplicates against existing queries", () => {
    const existing = ["visa Phnom Penh expats"];
    const queries = buildFallbackRound(
      1,
      "visa",
      "Phnom Penh",
      "teachers",
      existing
    );
    const lowerExisting = new Set(existing.map((q) => q.toLowerCase()));
    for (const q of queries) {
      expect(lowerExisting.has(q.toLowerCase())).toBe(false);
    }
  });
});
