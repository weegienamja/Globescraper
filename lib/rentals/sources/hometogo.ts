/**
 * HomeToGo source adapter for rental listings — STUB / DISABLED.
 *
 * HomeToGo is an aggregator of holiday/short-term rentals with nightly pricing
 * in GBP. It's a React SPA that would need Playwright, and listings link out
 * to booking sites (Booking.com, Agoda, etc.) rather than having their own
 * detail pages with monthly pricing.
 *
 * This adapter is disabled by default in config.ts because:
 *  - Nightly pricing doesn't map cleanly to monthly USD for the heatmap
 *  - JS-heavy SPA requires Playwright overhead
 *  - Aggregator (duplication risk with source sites)
 *
 * Kept as a stub so it can be enabled if the scraping strategy evolves.
 */

import { type PipelineLogFn, noopLogger } from "../pipelineLogger";
import type { PropertyType } from "@prisma/client";

/* ── Types ───────────────────────────────────────────────── */

export interface DiscoveredUrl {
  url: string;
  sourceListingId: string | null;
}

export interface ScrapedListing {
  sourceListingId: string | null;
  title: string;
  description: string | null;
  city: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  priceOriginal: string | null;
  priceMonthlyUsd: number | null;
  currency: string | null;
  imageUrls: string[];
  amenities: string[];
  postedAt: Date | null;
}

/* ── Discover (stub) ─────────────────────────────────────── */

export async function discoverHomeToGo(
  log: PipelineLogFn = noopLogger
): Promise<DiscoveredUrl[]> {
  log(
    "warn",
    "HomeToGo adapter is disabled: nightly GBP pricing, JS SPA, aggregator. " +
      "Enable in config.ts if strategy changes."
  );
  return [];
}

/* ── Scrape (stub) ───────────────────────────────────────── */

export async function scrapeListingHomeToGo(
  url: string,
  log: PipelineLogFn = noopLogger
): Promise<ScrapedListing | null> {
  log("warn", `HomeToGo scraping disabled — skipping ${url}`);
  return null;
}
