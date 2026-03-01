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

/* ── Human-like pacing ───────────────────────────────────── */

/** Every N listings, take a long "breather" pause */
export const BREATHER_EVERY_MIN = 15;
export const BREATHER_EVERY_MAX = 30;

/** Duration of breather pauses (ms) */
export const BREATHER_PAUSE_MIN_MS = 20_000;
export const BREATHER_PAUSE_MAX_MS = 40_000;

/** Probability (0-1) of skipping a listing entirely (simulates random navigation depth) */
export const SKIP_PROBABILITY = 0.03;

/** Extra "scroll/read" delay after fetching a page (ms) — simulates user reading time */
export const SCROLL_DELAY_MIN_MS = 800;
export const SCROLL_DELAY_MAX_MS = 3_000;

/** Night-time idle: UTC hours considered "night" — adds extra pause */
export const NIGHT_IDLE_START_HOUR_UTC = 17; // 00:00 ICT (UTC+7)
export const NIGHT_IDLE_END_HOUR_UTC = 23;   // 06:00 ICT (UTC+7)

/** Extra delay range during night hours (ms) */
export const NIGHT_IDLE_EXTRA_MIN_MS = 5_000;
export const NIGHT_IDLE_EXTRA_MAX_MS = 15_000;

/* ── User-Agent ──────────────────────────────────────────── */

export const USER_AGENT =
  "GlobescraperRentalsBot/1.0 (+https://globescraper.com/tools/rentals; research-only)";

/* ── Feature flags (ML) ──────────────────────────────────── */

export const ML_ENABLED = process.env.RENTALS_ML_ENABLED === "true";
export const EMBEDDINGS_ENABLED = process.env.RENTALS_EMBEDDINGS_ENABLED === "true";
