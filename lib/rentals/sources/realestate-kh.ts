/**
 * Realestate.com.kh source adapter for rental listings.
 *
 * Discover: fetches category index pages for condo/apartment rentals.
 * ScrapeListing: fetches an individual listing page, parses fields.
 *
 * NOTE: If content is heavily JS-rendered, a Playwright fallback may be
 * needed. For MVP we use fetch + cheerio and degrade gracefully.
 */

import * as cheerio from "cheerio";
import { fetchHtml, politeDelay } from "../http";
import { canonicalizeUrl } from "../url";
import { classifyPropertyType, shouldIngest } from "../classify";
import { parsePriceMonthlyUsd, parseBedsBathsSize, parseDistrict } from "../parse";
import { DISCOVER_MAX_PAGES, DISCOVER_MAX_URLS } from "../config";
import type { PropertyType } from "@prisma/client";

/* ── Category URLs ───────────────────────────────────────── */

const CATEGORY_URLS = [
  "https://www.realestate.com.kh/rent/condos/",
  "https://www.realestate.com.kh/rent/apartments/",
];

/* ── Types ───────────────────────────────────────────────── */

export interface DiscoveredUrl {
  url: string;
  sourceListingId: string | null;
}

export interface ScrapedListing {
  sourceListingId: string | null;
  title: string;
  description: string | null;
  district: string | null;
  propertyType: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  priceOriginal: string | null;
  priceMonthlyUsd: number | null;
  currency: string | null;
  imageUrls: string[];
  postedAt: Date | null;
}

/* ── Discover ────────────────────────────────────────────── */

/**
 * Discover listing URLs from realestate.com.kh category pages.
 * Respects DISCOVER_MAX_PAGES and DISCOVER_MAX_URLS caps.
 */
export async function discoverRealestateKh(): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  let pagesVisited = 0;

  for (const baseUrl of CATEGORY_URLS) {
    if (pagesVisited >= DISCOVER_MAX_PAGES) break;

    let pageUrl: string | null = baseUrl;

    while (pageUrl && pagesVisited < DISCOVER_MAX_PAGES && urls.length < DISCOVER_MAX_URLS) {
      pagesVisited++;
      const html = await fetchHtml(pageUrl);
      if (!html) break;

      const $ = cheerio.load(html);

      // Extract listing links
      $('a[href*="/rent/"]').each((_i, el) => {
        if (urls.length >= DISCOVER_MAX_URLS) return false;

        const href = $(el).attr("href");
        if (!href) return;

        const full = href.startsWith("http")
          ? href
          : `https://www.realestate.com.kh${href}`;

        if (!isListingUrl(full)) return;

        const canonical = canonicalizeUrl(full);
        const sourceId = extractListingId(full);

        if (!urls.some((u) => u.url === canonical)) {
          urls.push({ url: canonical, sourceListingId: sourceId });
        }
      });

      // Find next page link
      const nextLink = $(
        'a[rel="next"], .pagination a:contains("Next"), .pagination a:last-child'
      )
        .first()
        .attr("href");
      if (nextLink && nextLink !== pageUrl) {
        pageUrl = nextLink.startsWith("http")
          ? nextLink
          : `https://www.realestate.com.kh${nextLink}`;
      } else {
        pageUrl = null;
      }

      await politeDelay();
    }
  }

  return urls;
}

/* ── Scrape individual listing ───────────────────────────── */

/**
 * Scrape a single realestate.com.kh listing page and extract structured data.
 * Returns null if the page cannot be fetched or parsed.
 *
 * TODO: If this source heavily relies on JS rendering, add Playwright fallback
 * behind RENTALS_PLAYWRIGHT_ENABLED flag. Disabled by default.
 */
export async function scrapeListingRealestateKh(
  url: string
): Promise<ScrapedListing | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Title
  const title =
    $("h1").first().text().trim() ||
    $('[class*="title"]').first().text().trim();
  if (!title) return null;

  // Description
  const description =
    $('[class*="description"], .listing-description, .property-description')
      .first()
      .text()
      .trim() || null;

  // Classify
  const propertyType = classifyPropertyType(title, description);
  if (!shouldIngest(propertyType)) return null;

  // Price
  const priceText =
    $('[class*="price"], .listing-price').first().text().trim() || null;
  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);

  // Location
  const locationText =
    $('[class*="location"], .listing-location, .address')
      .first()
      .text()
      .trim() || null;
  const district = parseDistrict(locationText);

  // Beds, baths, size
  const detailText = $(
    '[class*="detail"], [class*="feature"], .amenities, .listing-info'
  ).text();
  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Images
  const imageUrls: string[] = [];
  $('[class*="gallery"] img, .listing-image img, .carousel img, [class*="photo"] img').each(
    (_i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http")) {
        imageUrls.push(src);
      }
    }
  );

  // Posted date (often in meta or structured data)
  let postedAt: Date | null = null;
  const jsonLd = $('script[type="application/ld+json"]').first().html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      if (data.datePosted) postedAt = new Date(data.datePosted);
    } catch {
      /* ignore invalid JSON-LD */
    }
  }

  const sourceListingId = extractListingId(url);
  const currency = priceText?.toLowerCase().includes("usd") ? "USD" : priceText ? "USD" : null;

  return {
    sourceListingId,
    title,
    description,
    district,
    propertyType,
    bedrooms,
    bathrooms,
    sizeSqm,
    priceOriginal: priceText,
    priceMonthlyUsd,
    currency,
    imageUrls,
    postedAt,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Individual listings typically have IDs or long slugs
    return (
      u.hostname.includes("realestate.com.kh") &&
      u.pathname.startsWith("/rent/") &&
      // Must be a detail page, not a category index
      u.pathname.split("/").filter(Boolean).length >= 3
    );
  } catch {
    return false;
  }
}

function extractListingId(url: string): string | null {
  // Try patterns like /rent/condos/12345 or /rent/...-12345.html
  const numMatch = url.match(/\/(\d{4,})(?:\.html)?(?:[?#]|$)/);
  if (numMatch) return numMatch[1];

  // Try slug-based ID from last path segment
  const slugMatch = url.match(/\/([a-z0-9-]+(?:-\d+))(?:\.html)?(?:[?#]|$)/i);
  if (slugMatch) return slugMatch[1];

  return null;
}
