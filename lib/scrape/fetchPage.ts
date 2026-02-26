/**
 * Polite page fetcher for AI Blog Generator.
 * Respects robots.txt, uses proper User-Agent, and caches results.
 */

const PAGE_CACHE = new Map<string, { html: string; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const USER_AGENT =
  "GlobescraperBot/1.0 (+https://globescraper.com; research-only)";

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetch a page's HTML content politely.
 * Returns null if the page cannot be fetched.
 */
export async function fetchPage(url: string): Promise<string | null> {
  // Check cache first
  const cached = PAGE_CACHE.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.html;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    const html = await response.text();

    // Cache the result
    PAGE_CACHE.set(url, { html, fetchedAt: Date.now() });

    return html;
  } catch {
    return null;
  }
}

/**
 * Check if robots.txt allows our bot to access the given URL.
 * Returns true if allowed or if robots.txt cannot be fetched.
 */
export async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return true; // No robots.txt = allowed

    const text = await response.text();
    const lines = text.split("\n");

    let isRelevantAgent = false;
    for (const rawLine of lines) {
      const line = rawLine.trim().toLowerCase();

      if (line.startsWith("user-agent:")) {
        const agent = line.slice("user-agent:".length).trim();
        isRelevantAgent = agent === "*" || agent.includes("globescraperbot");
      }

      if (isRelevantAgent && line.startsWith("disallow:")) {
        const path = line.slice("disallow:".length).trim();
        if (path && parsed.pathname.startsWith(path)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return true; // Allow on error
  }
}
