/**
 * Playwright-backed HTML fetcher for sites behind Cloudflare WAF.
 *
 * Uses a single long-lived browser instance with a pool of pages.
 * Headless Chromium renders JS + passes CF challenges automatically.
 *
 * Supports optional HTTP/SOCKS proxy via:
 *   - `configureProxy(url)` call from a script
 *   - `SCRAPE_PROXY` environment variable
 *
 * ⚠ Only used for LOCAL / CLI scripts — NOT compatible with Vercel
 *   serverless (no headless Chrome there). For deployed (Vercel) usage,
 *   pipe through a proxy or use the simple `fetchHtml` in http.ts.
 */

import { chromium, type Browser, type BrowserContext } from "playwright";

/* ── Configuration ───────────────────────────────────────── */

const BROWSER_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

/** Time to wait after navigation for CF challenge / lazy content (ms) */
const POST_NAV_WAIT_MS = parseInt(process.env.PW_WAIT_MS ?? "5000", 10);

/** Hard timeout for a full page load (ms) */
const PAGE_TIMEOUT_MS = 30_000;

/* ── Proxy config ────────────────────────────────────────── */

let _proxyUrl: string | null = process.env.SCRAPE_PROXY || null;

/**
 * Set the proxy URL for all future browser launches.
 * Call BEFORE any page fetches. Format: http://user:pass@host:port
 */
export function configureProxy(url: string | null): void {
  _proxyUrl = url;
  // Force browser restart on next request so proxy takes effect
  if (_context || _browser) {
    closeBrowser().catch(() => {});
  }
}

/* ── Singleton browser management ────────────────────────── */

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

/**
 * Get (or lazily create) the shared Chromium browser instance.
 */
async function getBrowserContext(): Promise<BrowserContext> {
  if (_context) return _context;

  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  };

  if (_proxyUrl) {
    // Playwright needs server, username, password as separate fields
    // Parse from URL format: http://user:pass@host:port
    try {
      const parsed = new URL(_proxyUrl);
      const serverOnly = `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
      launchOptions.proxy = {
        server: serverOnly,
        ...(parsed.username && { username: decodeURIComponent(parsed.username) }),
        ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
      };
    } catch {
      // Fallback: treat as plain server URL (no auth)
      launchOptions.proxy = { server: _proxyUrl };
    }
  }

  _browser = await chromium.launch(launchOptions);

  const ua = BROWSER_UAS[Math.floor(Math.random() * BROWSER_UAS.length)];

  _context = await _browser.newContext({
    userAgent: ua,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    javaScriptEnabled: true,
  });

  return _context;
}

/**
 * Close the shared browser (call at end of a pipeline run).
 */
export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

/* ── Public API ──────────────────────────────────────────── */

/**
 * Fetch a page's fully-rendered HTML using headless Chromium.
 * Returns null if the page fails to load.
 */
export async function fetchHtmlPlaywright(
  url: string,
  options?: { waitMs?: number; scrollToBottom?: boolean }
): Promise<string | null> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: PAGE_TIMEOUT_MS,
    });

    if (!response) {
      console.error(`[PW] No response for ${url}`);
      return null;
    }
    if (response.status() >= 400) {
      console.error(`[PW] HTTP ${response.status()} for ${url}`);
      return null;
    }

    // Wait for SPA hydration / dynamic content
    await page.waitForTimeout(options?.waitMs ?? POST_NAV_WAIT_MS);

    // Check for Cloudflare challenge page
    const title = await page.title();
    if (title.includes("Just a moment") || title.includes("Attention Required")) {
      console.error(`[PW] Cloudflare challenge detected for ${url} (title: "${title}")`);
      // Give extra time for CF challenge to resolve
      await page.waitForTimeout(8_000);
      const retryTitle = await page.title();
      if (retryTitle.includes("Just a moment") || retryTitle.includes("Attention Required")) {
        console.error(`[PW] CF challenge not resolved after 8s wait for ${url}`);
        return null;
      }
    }

    // Optional: scroll to bottom to trigger lazy-loading
    if (options?.scrollToBottom) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1_500);
    }

    return await page.content();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PW] Error fetching ${url}: ${msg}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Fetch a category page and scroll repeatedly to load all lazy items.
 * Returns the final HTML after scrolling `scrollCount` times.
 */
export async function fetchCategoryPagePlaywright(
  url: string,
  scrollCount: number = 0
): Promise<string | null> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: PAGE_TIMEOUT_MS,
    });

    if (!response || response.status() >= 400) {
      return null;
    }

    await page.waitForTimeout(POST_NAV_WAIT_MS);

    // Scroll to load lazy content
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1_500);
    }

    return await page.content();
  } catch {
    return null;
  } finally {
    await page.close();
  }
}
