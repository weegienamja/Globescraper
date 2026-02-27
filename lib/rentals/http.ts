/**
 * HTTP throttle + retry utilities for the rental scraping pipeline.
 *
 * - Concurrency-limited fetcher
 * - Exponential backoff with jitter
 * - Polite delay between requests
 */

import {
  CONCURRENCY_LIMIT,
  REQUEST_DELAY_BASE_MS,
  REQUEST_DELAY_JITTER_MS,
  MAX_RETRIES,
  USER_AGENT,
} from "./config";

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

export function politeDelay(): Promise<void> {
  const ms = REQUEST_DELAY_BASE_MS + Math.random() * REQUEST_DELAY_JITTER_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
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
