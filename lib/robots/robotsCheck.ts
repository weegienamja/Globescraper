/**
 * Robots.txt checker for the news topic discovery pipeline.
 * Reuses the existing fetchPage approach but provides a dedicated module
 * for caching robots.txt results across multiple URL checks.
 */

const ROBOTS_CACHE = new Map<string, { allowed: Set<string>; disallowed: Set<string>; fetchedAt: number }>();
const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const USER_AGENT = "GlobescraperBot/1.0 (+https://globescraper.com; research-only)";
const FETCH_TIMEOUT_MS = 5_000;

interface RobotsRule {
  allowed: Set<string>;
  disallowed: Set<string>;
}

/**
 * Parse robots.txt content for our user agent.
 */
function parseRobotsTxt(text: string): RobotsRule {
  const lines = text.split("\n");
  const allowed = new Set<string>();
  const disallowed = new Set<string>();

  let isRelevantAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();

    if (line.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      isRelevantAgent = agent === "*" || agent.includes("globescraperbot");
    }

    if (isRelevantAgent) {
      if (line.startsWith("disallow:")) {
        const path = line.slice("disallow:".length).trim();
        if (path) disallowed.add(path);
      }
      if (line.startsWith("allow:")) {
        const path = line.slice("allow:".length).trim();
        if (path) allowed.add(path);
      }
    }
  }

  return { allowed, disallowed };
}

/**
 * Fetch and cache robots.txt for a given host.
 */
async function fetchRobotsRules(host: string, protocol: string): Promise<RobotsRule> {
  const cacheKey = `${protocol}//${host}`;
  const cached = ROBOTS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return { allowed: cached.allowed, disallowed: cached.disallowed };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${protocol}//${host}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // No robots.txt or error means everything is allowed
      const emptyRule: RobotsRule = { allowed: new Set(), disallowed: new Set() };
      ROBOTS_CACHE.set(cacheKey, { ...emptyRule, fetchedAt: Date.now() });
      return emptyRule;
    }

    const text = await response.text();
    const rules = parseRobotsTxt(text);
    ROBOTS_CACHE.set(cacheKey, { ...rules, fetchedAt: Date.now() });
    return rules;
  } catch {
    // On error, assume allowed
    return { allowed: new Set(), disallowed: new Set() };
  }
}

/**
 * Check whether a URL is allowed by robots.txt for our bot.
 * Returns true if allowed, false if blocked.
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const rules = await fetchRobotsRules(parsed.host, parsed.protocol);

    // Check explicit allows first (they override disallows)
    for (const allowedPath of rules.allowed) {
      if (parsed.pathname.startsWith(allowedPath)) {
        return true;
      }
    }

    // Check disallows
    for (const disallowedPath of rules.disallowed) {
      if (parsed.pathname.startsWith(disallowedPath)) {
        return false;
      }
    }

    return true;
  } catch {
    return true; // On parse error, assume allowed
  }
}
