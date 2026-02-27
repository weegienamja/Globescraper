/**
 * Auto-discover competitor articles for a given topic and keyword.
 *
 * Uses Serper.dev Google Search API when configured (SERPER_API_KEY env var).
 * Falls back to constructing likely competitor URLs from known
 * Cambodia/expat content sites.
 *
 * Also gathers all existing GlobeScraper content (static + AI) so the
 * generator can produce unique articles that don't overlap.
 */

import { fetchPage } from "./fetchPage";
import { extractTitle } from "./extractMainText";
import { prisma } from "@/lib/prisma";
import { getPostsMeta } from "@/lib/content";

/* ------------------------------------------------------------------ */
/*  Competitor URL discovery                                           */
/* ------------------------------------------------------------------ */

/** Well-known sites that rank for Cambodia expat/teaching content. */
const COMPETITOR_DOMAINS = [
  "move2cambodia.com",
  "expatinkh.com",
  "lonelyplanet.com",
  "theculturetrip.com",
  "goabroad.com",
  "internationalteflacademy.com",
  "nomadlist.com",
  "wikitravel.org",
  "livingcost.org",
  "expatistan.com",
  "reddit.com",
  "medium.com",
  "thediplomat.com",
  "worldnomads.com",
  "expatarrivals.com",
  "transferwise.com",
];

export interface DiscoveredCompetitor {
  url: string;
  title: string | null;
  source: "serper" | "heuristic" | "manual";
}

/**
 * Discover competitor article URLs for a topic.
 *
 * Strategy:
 * 1. If SERPER_API_KEY is set, query Serper.dev
 *    for the top organic results (excludes our own domain).
 * 2. Otherwise, build heuristic URLs from known competitor domains.
 * 3. Merge with any manually provided URLs.
 *
 * Returns up to 5 competitor URLs total.
 */
export async function discoverCompetitors(
  city: string,
  topic: string,
  targetKeyword?: string,
  manualUrls: string[] = []
): Promise<DiscoveredCompetitor[]> {
  const results: DiscoveredCompetitor[] = [];
  const seenUrls = new Set<string>();

  // Add manual URLs first (highest priority)
  for (const url of manualUrls) {
    const trimmed = url.trim();
    if (trimmed && !seenUrls.has(trimmed)) {
      seenUrls.add(trimmed);
      results.push({ url: trimmed, title: null, source: "manual" });
    }
  }

  // Try Serper.dev search
  const serperKey = process.env.SERPER_API_KEY;

  if (serperKey) {
    try {
      const query = targetKeyword
        ? `${targetKeyword} ${city} Cambodia`
        : `${city} Cambodia ${topic} guide`;

      const searchResults = await searchSerper(query, serperKey);
      for (const r of searchResults) {
        if (results.length >= 5) break;
        if (!seenUrls.has(r.url) && !isOwnSite(r.url)) {
          seenUrls.add(r.url);
          results.push({ url: r.url, title: r.title, source: "serper" });
        }
      }
    } catch (err) {
      console.error("[CompetitorDiscovery] Serper search failed, falling back to heuristics:", err);
    }
  }

  // Fill remaining slots with heuristic URLs
  if (results.length < 5) {
    const heuristic = buildHeuristicCompetitorUrls(city, topic, targetKeyword);
    for (const url of heuristic) {
      if (results.length >= 5) break;
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        results.push({ url, title: null, source: "heuristic" });
      }
    }
  }

  return results;
}

/**
 * Query Serper.dev Google Search API.
 */
async function searchSerper(
  query: string,
  apiKey: string
): Promise<Array<{ url: string; title: string }>> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: `${query} -site:globescraper.com`,
      num: 8,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Serper error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const items = data.organic || [];

  return items.map((item: { link: string; title: string }) => ({
    url: item.link,
    title: item.title,
  }));
}

/**
 * Build plausible competitor URLs from known domains.
 */
function buildHeuristicCompetitorUrls(
  city: string,
  topic: string,
  targetKeyword?: string
): string[] {
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const topicSlug = topic.toLowerCase().replace(/\s+/g, "-");
  const kwSlug = targetKeyword
    ? targetKeyword.toLowerCase().replace(/\s+/g, "-")
    : `${topicSlug}-${citySlug}`;

  const urls: string[] = [];

  // Move to Cambodia - very likely to have content
  urls.push(`https://move2cambodia.com/${topicSlug}`);
  urls.push(`https://move2cambodia.com/${citySlug}`);
  urls.push(`https://move2cambodia.com/${topicSlug}-${citySlug}`);

  // Expat in KH
  urls.push(`https://expatinkh.com/${kwSlug}`);

  // Living cost comparison sites
  urls.push(`https://www.numbeo.com/cost-of-living/in/${city.replace(/\s+/g, "-")}`);
  urls.push(`https://www.expatistan.com/cost-of-living/${citySlug}`);
  urls.push(`https://livingcost.org/cost/${citySlug}`);

  // General travel sites
  urls.push(`https://www.lonelyplanet.com/cambodia/${citySlug}`);
  urls.push(`https://theculturetrip.com/asia/cambodia/${topicSlug}`);

  // Reddit
  urls.push(`https://www.reddit.com/r/cambodia/search/?q=${encodeURIComponent(`${city} ${topic}`)}`);

  // TEFL-specific (if topic is about teaching)
  if (/teach|tefl|class|school|esl/i.test(topic)) {
    urls.push(`https://www.goabroad.com/teach-abroad/teach-abroad-in-cambodia`);
    urls.push(`https://www.internationalteflacademy.com/teach-english-in-cambodia`);
  }

  return urls;
}

/**
 * Check if a URL belongs to our own site.
 */
function isOwnSite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname === "globescraper.com" || hostname.endsWith(".globescraper.com");
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Existing content deduplication                                     */
/* ------------------------------------------------------------------ */

export interface ExistingArticleSummary {
  slug: string;
  title: string;
  description: string;
  city?: string;
  topic?: string;
  /** First 300 chars of content for overlap detection */
  contentPreview: string;
  source: "static" | "ai_published" | "ai_draft";
}

/**
 * Gather all existing GlobeScraper content (static posts + AI drafts/published)
 * and produce a digest the generation prompt can use to avoid duplication.
 *
 * Returns both the raw list and a formatted prompt section.
 */
export async function buildExistingContentDigest(): Promise<{
  articles: ExistingArticleSummary[];
  promptSection: string;
}> {
  const articles: ExistingArticleSummary[] = [];

  // 1. Static posts from posts.json
  try {
    const staticPosts = getPostsMeta();
    for (const post of staticPosts) {
      articles.push({
        slug: post.slug,
        title: post.title.replace(" | GlobeScraper", ""),
        description: post.description,
        contentPreview: post.description, // static posts don't have markdown in meta
        source: "static",
      });
    }
  } catch {
    // posts.json might not exist in some environments
  }

  // 2. All AI drafts and published articles from the database
  try {
    const aiArticles = await prisma.generatedArticleDraft.findMany({
      where: {
        status: { in: ["PUBLISHED", "DRAFT"] },
      },
      select: {
        slug: true,
        title: true,
        metaDescription: true,
        city: true,
        topic: true,
        markdown: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    for (const article of aiArticles) {
      articles.push({
        slug: article.slug,
        title: article.title,
        description: article.metaDescription,
        city: article.city,
        topic: article.topic,
        contentPreview: article.markdown.slice(0, 300),
        source: article.status === "PUBLISHED" ? "ai_published" : "ai_draft",
      });
    }
  } catch {
    // Database might not be available
  }

  // Build the prompt section
  if (articles.length === 0) {
    return {
      articles,
      promptSection: "",
    };
  }

  const articleList = articles
    .map((a) => {
      const tags: string[] = [a.source];
      if (a.city) tags.push(a.city);
      if (a.topic) tags.push(a.topic);
      return `- "${a.title}" (/${a.slug}) [${tags.join(", ")}]\n  ${a.description}`;
    })
    .join("\n");

  const promptSection = `
=== EXISTING GLOBESCRAPER ARTICLES (DO NOT DUPLICATE) ===
The following articles already exist on GlobeScraper. Your new article MUST be
unique and must NOT substantially overlap with any of them. Take a different
angle, cover different subtopics, or focus on a different aspect of the topic.

If the topic is very similar to an existing article, differentiate by:
1. Targeting a different audience segment
2. Focusing on a specific neighborhood, time period, or scenario
3. Going deeper into one subtopic instead of giving a broad overview
4. Using a completely different structure (listicle vs guide vs comparison)

Existing articles:
${articleList}
==========================================================
`.trim();

  return { articles, promptSection };
}
