/**
 * Playwright-backed HTML fetcher for sites behind Cloudflare WAF.
 *
 * Uses a single long-lived browser instance with a pool of pages.
 * Headless Chromium renders JS + passes CF challenges automatically.
 *
 * ⚠ Only used for LOCAL / CLI scripts — NOT compatible with Vercel
 *   serverless (no headless Chrome there). For deployed (Vercel) usage,
 *   pipe through a proxy or use the simple `fetchHtml` in http.ts.
 */

import { chromium, type Browser, type BrowserContext } from "playwright";

/* ── Configuration ───────────────────────────────────────── */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Time to wait after navigation for CF challenge / lazy content (ms) */
const POST_NAV_WAIT_MS = 3_000;

/** Hard timeout for a full page load (ms) */
const PAGE_TIMEOUT_MS = 30_000;

/* ── Singleton browser management ────────────────────────── */

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

/**
 * Get (or lazily create) the shared Chromium browser instance.
 */
async function getBrowserContext(): Promise<BrowserContext> {
  if (_context) return _context;

  _browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });

  _context = await _browser.newContext({
    userAgent: BROWSER_UA,
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
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    });

    if (!response || response.status() >= 400) {
      return null;
    }

    // Wait for CF challenge / dynamic content
    await page.waitForTimeout(options?.waitMs ?? POST_NAV_WAIT_MS);

    // Optional: scroll to bottom to trigger lazy-loading
    if (options?.scrollToBottom) {
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
      waitUntil: "domcontentloaded",
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
