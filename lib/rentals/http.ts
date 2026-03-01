/**
 * HTTP throttle + retry utilities for the rental scraping pipeline.
 *
 * - Concurrency-limited fetcher
 * - Exponential backoff with jitter
 * - Polite delay between requests
 * - Optional proxy support via SCRAPE_PROXY env var
 */

import {
  CONCURRENCY_LIMIT,
  REQUEST_DELAY_BASE_MS,
  REQUEST_DELAY_JITTER_MS,
  MAX_RETRIES,
  USER_AGENT,
  BREATHER_EVERY_MIN,
  BREATHER_EVERY_MAX,
  BREATHER_PAUSE_MIN_MS,
  BREATHER_PAUSE_MAX_MS,
  SCROLL_DELAY_MIN_MS,
  SCROLL_DELAY_MAX_MS,
  NIGHT_IDLE_START_HOUR_UTC,
  NIGHT_IDLE_END_HOUR_UTC,
  NIGHT_IDLE_EXTRA_MIN_MS,
  NIGHT_IDLE_EXTRA_MAX_MS,
} from "./config";
import { ProxyAgent } from "undici";

/* ── Proxy support ───────────────────────────────────────── */

/**
 * If SCRAPE_PROXY is set, all scraper HTTP requests route through it.
 * Supports HTTP/HTTPS proxies, e.g.:
 *   SCRAPE_PROXY=http://user:pass@cambodia-proxy.example.com:8080
 *   SCRAPE_PROXY=http://123.456.789.0:3128
 */
const PROXY_URL = process.env.SCRAPE_PROXY || "";
let proxyDispatcher: ProxyAgent | undefined;

if (PROXY_URL) {
  proxyDispatcher = new ProxyAgent(PROXY_URL);
  console.log(`[http] 🌏 Proxy enabled: ${PROXY_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
}

/* ── Semaphore for concurrency ───────────────────────────── */

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSemaphore(): Promise<void> {
  if (activeRequests < CONCURRENCY_LIMIT) {
    activeRequests++;
    return;
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSemaphore(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

/* ── Polite delay ────────────────────────────────────────── */

/**
 * Inconsistent pacing: occasionally doubles or triples the delay
 * to mimic a human who sometimes gets distracted.
 */
export function politeDelay(): Promise<void> {
  let ms = REQUEST_DELAY_BASE_MS + Math.random() * REQUEST_DELAY_JITTER_MS;

  // ~12% chance of a longer-than-usual pause ("reading" the page)
  if (Math.random() < 0.12) {
    ms += 2_000 + Math.random() * 4_000;
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulate scroll/read time after fetching a page.
 * Adds a short variable delay as if a user is scrolling through content.
 */
export function scrollDelay(): Promise<void> {
  const ms = SCROLL_DELAY_MIN_MS + Math.random() * (SCROLL_DELAY_MAX_MS - SCROLL_DELAY_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the current UTC hour falls within the night-time window.
 * During night hours, scrapers should add extra idle time.
 */
export function isNightTime(): boolean {
  const hour = new Date().getUTCHours();
  return hour >= NIGHT_IDLE_START_HOUR_UTC || hour < NIGHT_IDLE_END_HOUR_UTC;
}

/**
 * Extra delay applied during night-time hours to simulate
 * a user who is less active.
 */
export function nightIdleDelay(): Promise<void> {
  if (!isNightTime()) return Promise.resolve();
  const ms = NIGHT_IDLE_EXTRA_MIN_MS + Math.random() * (NIGHT_IDLE_EXTRA_MAX_MS - NIGHT_IDLE_EXTRA_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Counter for breather logic — tracks listings since last breather. */
let listingsSinceBreather = 0;
let nextBreatherAt = randomInt(BREATHER_EVERY_MIN, BREATHER_EVERY_MAX);

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Call after each listing is processed.  Occasionally triggers a long
 * 20-40s "breather" pause to look less bot-like.
 * Returns true if a breather was taken.
 */
export async function maybeBreather(logFn?: (msg: string) => void): Promise<boolean> {
  listingsSinceBreather++;
  if (listingsSinceBreather < nextBreatherAt) return false;

  const pauseMs = BREATHER_PAUSE_MIN_MS + Math.random() * (BREATHER_PAUSE_MAX_MS - BREATHER_PAUSE_MIN_MS);
  if (logFn) logFn(`☕ Breather pause — ${(pauseMs / 1000).toFixed(0)}s (after ${listingsSinceBreather} listings)`);
  await new Promise((resolve) => setTimeout(resolve, pauseMs));

  listingsSinceBreather = 0;
  nextBreatherAt = randomInt(BREATHER_EVERY_MIN, BREATHER_EVERY_MAX);
  return true;
}

/**
 * Probability-based skip check — returns true if this listing should
 * be skipped to simulate random navigation depth.
 */
export function shouldSkipListing(): boolean {
  return Math.random() < 0.03;
}

/* ── Retry with backoff ──────────────────────────────────── */

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused") ||
      msg.includes("socket hang up") ||
      msg.includes("abort") ||
      msg.includes("network")
    );
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/* ── Throttled fetch ─────────────────────────────────────── */

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch a URL with concurrency limiting, polite delay, and retry with backoff.
 * Returns the Response or null on permanent failure.
 */
export async function throttledFetch(
  url: string,
  options?: { maxRetries?: number }
): Promise<Response | null> {
  const retries = options?.maxRetries ?? MAX_RETRIES;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await acquireSemaphore();
    try {
      // Polite delay before each request
      if (attempt > 0 || activeRequests > 1) {
        await politeDelay();
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
        redirect: "follow",
        // @ts-expect-error — undici dispatcher is valid at runtime but not in DOM fetch types
        dispatcher: proxyDispatcher,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      if (isRetryableStatus(response.status) && attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(
          `[throttledFetch] ${url} → ${response.status}, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${retries})`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      // Non-retryable HTTP error
      console.warn(`[throttledFetch] ${url} → ${response.status} (permanent)`);
      return null;
    } catch (error) {
      if (isRetryableError(error) && attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(
          `[throttledFetch] ${url} → network error, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${retries})`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.warn(`[throttledFetch] ${url} → failed permanently:`, error);
      return null;
    } finally {
      releaseSemaphore();
    }
  }

  return null;
}

/**
 * Convenience: fetch and return HTML text, or null.
 */
export async function fetchHtml(url: string): Promise<string | null> {
  const response = await throttledFetch(url);
  if (!response) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return null;
  }

  return response.text();
}
