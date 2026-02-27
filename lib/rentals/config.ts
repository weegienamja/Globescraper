/**
 * Rental Data Pipeline – Global Configuration
 *
 * Centralised caps, concurrency limits, and source enable/disable flags.
 */

import { RentalSource } from "@prisma/client";

/* ── Source toggles ──────────────────────────────────────── */

export const enabledSources: Record<RentalSource, boolean> = {
  KHMER24: false, // Blocked by Cloudflare WAF – needs Playwright
  REALESTATE_KH: true,
};

export function isSourceEnabled(source: RentalSource): boolean {
  return enabledSources[source] ?? false;
}

/* ── Caps ────────────────────────────────────────────────── */

/** Max category/index pages fetched per discover run */
export const DISCOVER_MAX_PAGES = 20;

/** Max listing URLs enqueued per discover run */
export const DISCOVER_MAX_URLS = 500;

/** Max listing detail pages processed per process-queue run */
export const PROCESS_QUEUE_MAX = 50;

/** How many listings to scrape in parallel within a batch */
export const PROCESS_QUEUE_CONCURRENCY = 5;

/** HTTP concurrency limit for outbound requests */
export const CONCURRENCY_LIMIT = 6;

/** Base delay between HTTP requests (ms) */
export const REQUEST_DELAY_BASE_MS = 600;

/** Random jitter range added to base delay (ms) */
export const REQUEST_DELAY_JITTER_MS = 400;

/** Max retries for transient network errors */
export const MAX_RETRIES = 3;

/* ── User-Agent ──────────────────────────────────────────── */

export const USER_AGENT =
  "GlobescraperRentalsBot/1.0 (+https://globescraper.com/tools/rentals; research-only)";

/* ── Feature flags (ML) ──────────────────────────────────── */

export const ML_ENABLED = process.env.RENTALS_ML_ENABLED === "true";
export const EMBEDDINGS_ENABLED = process.env.RENTALS_EMBEDDINGS_ENABLED === "true";
