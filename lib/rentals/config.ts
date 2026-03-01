/**
 * Rental Data Pipeline – Global Configuration
 *
 * Centralised caps, concurrency limits, and source enable/disable flags.
 */

import { RentalSource } from "@prisma/client";

/* ── Source toggles ──────────────────────────────────────── */

export const enabledSources: Record<RentalSource, boolean> = {
  KHMER24: true,
  REALESTATE_KH: true,
  IPS_CAMBODIA: true,
  CAMREALTY: true,
  LONGTERMLETTINGS: true,
  FAZWAZ: true,
  HOMETOGO: false, // Disabled: nightly GBP pricing, JS SPA, aggregator — poor fit for monthly USD heatmap
};

export function isSourceEnabled(source: RentalSource): boolean {
  return enabledSources[source] ?? false;
}

/* ── Caps ────────────────────────────────────────────────── */

/** Max category/index pages fetched per discover run */
export const DISCOVER_MAX_PAGES = parseInt(process.env.RENTALS_MAX_PAGES ?? "20", 10);

/** Max listing URLs enqueued per discover run */
export const DISCOVER_MAX_URLS = parseInt(process.env.RENTALS_MAX_URLS ?? "500", 10);

/** Max listing detail pages processed per process-queue run */
export const PROCESS_QUEUE_MAX = parseInt(process.env.RENTALS_MAX_PROCESS ?? "50", 10);

/** How many listings to scrape in parallel within a batch */
export const PROCESS_QUEUE_CONCURRENCY = parseInt(process.env.RENTALS_CONCURRENCY ?? "1", 10);

/** HTTP concurrency limit for outbound requests */
export const CONCURRENCY_LIMIT = 2;

/** Base delay between HTTP requests (ms) */
export const REQUEST_DELAY_BASE_MS = 3_000;

/** Random jitter range added to base delay (ms) */
export const REQUEST_DELAY_JITTER_MS = 2_000;

/** Max retries for transient network errors */
export const MAX_RETRIES = 3;

/* ── User-Agent ──────────────────────────────────────────── */

export const USER_AGENT =
  "GlobescraperRentalsBot/1.0 (+https://globescraper.com/tools/rentals; research-only)";

/* ── Feature flags (ML) ──────────────────────────────────── */

export const ML_ENABLED = process.env.RENTALS_ML_ENABLED === "true";
export const EMBEDDINGS_ENABLED = process.env.RENTALS_EMBEDDINGS_ENABLED === "true";
