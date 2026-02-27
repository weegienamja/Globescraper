/**
 * Khmer24 source adapter for rental listings.
 *
 * Discover: fetches category index pages, extracts listing URLs.
 * ScrapeListing: fetches an individual listing page, parses fields.
 */

import * as cheerio from "cheerio";
import { fetchHtml, politeDelay } from "../http";
import { canonicalizeUrl } from "../url";
import { classifyPropertyType, shouldIngest } from "../classify";
import { parsePriceMonthlyUsd, parseBedsBathsSize, parseDistrict } from "../parse";
import { DISCOVER_MAX_PAGES, DISCOVER_MAX_URLS } from "../config";
import type { PropertyType } from "@prisma/client";

/* ── Category URLs for condos / apartments ───────────────── */

const CATEGORY_URLS = [
  "https://www.khmer24.com/en/apartment-for-rent.html",
  "https://www.khmer24.com/en/condo-for-rent.html",
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
 * Discover listing URLs from Khmer24 category index pages.
 * Respects DISCOVER_MAX_PAGES and DISCOVER_MAX_URLS caps.
 */
export async function discoverKhmer24(): Promise<DiscoveredUrl[]> {
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

      // Extract listing links – Khmer24 uses various link patterns
      $('a[href*="/en/"]').each((_i, el) => {
        if (urls.length >= DISCOVER_MAX_URLS) return false;

        const href = $(el).attr("href");
        if (!href) return;

        const full = href.startsWith("http") ? href : `https://www.khmer24.com${href}`;

        // Khmer24 listing URLs typically contain an ad ID
        // Pattern: /en/<slug>-<id>.html  or similar with numeric segments
        if (!isListingUrl(full)) return;

        const canonical = canonicalizeUrl(full);
        const sourceId = extractListingId(full);

        // Avoid duplicates in this batch
        if (!urls.some((u) => u.url === canonical)) {
          urls.push({ url: canonical, sourceListingId: sourceId });
        }
      });

      // Find next page link
      const nextLink = $('a[rel="next"], .pagination a:contains("Next"), .pagination a:contains("»")').first().attr("href");
      if (nextLink && nextLink !== pageUrl) {
        pageUrl = nextLink.startsWith("http") ? nextLink : `https://www.khmer24.com${nextLink}`;
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
 * Scrape a single Khmer24 listing page and extract structured data.
 * Returns null if the page cannot be fetched or parsed.
 */
export async function scrapeListingKhmer24(url: string): Promise<ScrapedListing | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Title
  const title = $("h1").first().text().trim() || $(".item-title").first().text().trim();
  if (!title) return null;

  // Description
  const description =
    $(".item-description, .description, [class*='description']").first().text().trim() || null;

  // Classify property type
  const propertyType = classifyPropertyType(title, description);
  if (!shouldIngest(propertyType)) return null;

  // Price
  const priceText =
    $(".item-price, .price, [class*='price']").first().text().trim() || null;
  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);

  // Location / district
  const locationText =
    $(".item-location, .location, [class*='location']").first().text().trim() || null;
  const district = parseDistrict(locationText);

  // Beds, baths, size from detail table or text
  const detailText = $(".item-detail, .detail-info, .amenities, [class*='detail']")
    .text()
    .trim();
  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Images
  const imageUrls: string[] = [];
  $(".item-gallery img, .gallery img, [class*='gallery'] img, .item-image img").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.startsWith("http")) {
      imageUrls.push(src);
    }
  });

  // Posted date
  const postedAt = parsePostedDate($);

  // Source listing ID
  const sourceListingId = extractListingId(url);

  // Currency
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
    // Khmer24 listing pages are typically /en/<slug>-<id>.html
    return (
      u.hostname.includes("khmer24.com") &&
      /\/en\/.+-\d+\.html/.test(u.pathname) &&
      !u.pathname.includes("/search") &&
      !u.pathname.includes("/category") &&
      !u.pathname.includes("/page/")
    );
  } catch {
    return false;
  }
}

function extractListingId(url: string): string | null {
  // Try to extract numeric ID from URL like /en/...-12345.html
  const match = url.match(/-(\d{4,})\.html/);
  return match ? match[1] : null;
}

function parsePostedDate($: cheerio.CheerioAPI): Date | null {
  // Look for posted date in common selectors
  const dateText = $(".item-date, .posted-date, [class*='date'], time")
    .first()
    .text()
    .trim();
  if (!dateText) return null;

  // Try ISO date
  const d = new Date(dateText);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

  // Try relative date patterns like "2 days ago"
  const relative = dateText.match(/(\d+)\s*(day|hour|minute|week|month)s?\s*ago/i);
  if (relative) {
    const n = parseInt(relative[1]);
    const unit = relative[2].toLowerCase();
    const now = new Date();
    switch (unit) {
      case "minute": return new Date(now.getTime() - n * 60_000);
      case "hour": return new Date(now.getTime() - n * 3_600_000);
      case "day": return new Date(now.getTime() - n * 86_400_000);
      case "week": return new Date(now.getTime() - n * 7 * 86_400_000);
      case "month": return new Date(now.getTime() - n * 30 * 86_400_000);
    }
  }

  return null;
}
