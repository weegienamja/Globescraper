/**
 * IPS Cambodia source adapter for rental listings.
 *
 * Discover: fetches category index pages at /rent/?paging=N (500+ pages).
 * ScrapeListing: fetches an individual listing page, parses fields.
 *
 * Listing URL patterns:
 *   /listing-details/rental/{id}-{slug}/
 *   /listing-details/commercial/{id}-{slug}/
 */

import * as cheerio from "cheerio";
import { fetchHtml, politeDelay } from "../http";
import { canonicalizeUrl } from "../url";
import { classifyPropertyType, shouldIngest } from "../classify";
import {
  parsePriceMonthlyUsd,
  parseBedsBathsSize,
  parseDistrict,
  parseCity,
  parseAmenities,
} from "../parse";
import { DISCOVER_MAX_PAGES, DISCOVER_MAX_URLS } from "../config";
import type { PropertyType } from "@prisma/client";
import { type PipelineLogFn, noopLogger } from "../pipelineLogger";

/* ── Category URLs ───────────────────────────────────────── */

const CATEGORY_URLS = ["https://ips-cambodia.com/rent/"];

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

/* ── Discover ────────────────────────────────────────────── */

export async function discoverIpsCambodia(
  log: PipelineLogFn = noopLogger
): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  let pagesVisited = 0;

  for (const baseUrl of CATEGORY_URLS) {
    if (pagesVisited >= DISCOVER_MAX_PAGES) break;
    log("info", `Scanning category: ${baseUrl}`);

    let pageNum = 1;

    while (
      pagesVisited < DISCOVER_MAX_PAGES &&
      urls.length < DISCOVER_MAX_URLS
    ) {
      const pageUrl =
        pageNum === 1 ? baseUrl : `${baseUrl}?paging=${pageNum}`;
      pagesVisited++;
      log("info", `Fetching page ${pagesVisited}: ${pageUrl}`);

      const html = await fetchHtml(pageUrl);
      if (!html) {
        log("warn", `No HTML returned for ${pageUrl}`);
        break;
      }

      const $ = cheerio.load(html);
      const beforeCount = urls.length;

      // IPS listing links follow /listing-details/(rental|commercial)/{id}-{slug}/
      $("a[href]").each((_i, el) => {
        if (urls.length >= DISCOVER_MAX_URLS) return false;

        const href = $(el).attr("href");
        if (!href) return;

        const full = href.startsWith("http")
          ? href
          : `https://ips-cambodia.com${href}`;

        if (!isListingUrl(full)) return;

        const canonical = canonicalizeUrl(full);
        if (seen.has(canonical)) return;
        seen.add(canonical);

        urls.push({
          url: canonical,
          sourceListingId: extractListingId(full),
        });
      });

      const newFound = urls.length - beforeCount;
      log(
        "info",
        `Page ${pagesVisited}: found ${newFound} new listing links (total: ${urls.length})`
      );

      if (newFound === 0) {
        log("info", "No more listings found — moving on");
        break;
      }

      pageNum++;
      await politeDelay();
    }
  }

  log(
    "info",
    `Discovery complete: ${urls.length} unique URLs from ${pagesVisited} pages`
  );
  return urls;
}

/* ── Scrape individual listing ───────────────────────────── */

export async function scrapeListingIpsCambodia(
  url: string,
  log: PipelineLogFn = noopLogger
): Promise<ScrapedListing | null> {
  log("debug", `Fetching listing page: ${url}`);
  const html = await fetchHtml(url);
  if (!html) {
    log("warn", `No HTML returned for listing: ${url}`);
    return null;
  }

  const $ = cheerio.load(html);

  // Title
  const title =
    $("h1").first().text().trim() ||
    $('[class*="title"]').first().text().trim();
  if (!title) {
    log("warn", `No title found on page: ${url}`);
    return null;
  }
  log("debug", `Title: ${title}`);

  // Description
  const description =
    $(
      '[class*="description"], .listing-description, .property-description, .detail-content'
    )
      .first()
      .text()
      .trim() || null;

  // Classify
  const propertyType = classifyPropertyType(title, description);
  if (!propertyType) {
    log("debug", `Skipped non-residential listing: ${title.slice(0, 80)}`);
    return null;
  }
  log("debug", `Classified as: ${propertyType}`);

  // Price — look for "$X,XXX / month" pattern common on IPS
  let priceText: string | null = null;

  // Strategy 1: look for the price in the listing detail section
  const priceEl = $('[class*="price"], .listing-price, .detail-price').first();
  if (priceEl.length) {
    priceText = priceEl.text().trim();
  }

  // Strategy 2: look for structured "$X / month" in the page text
  if (!priceText) {
    const bodyText = $("body").text();
    const m = bodyText.match(/\$\s*([\d,]+)\s*\/?\s*month/i);
    if (m) priceText = "$" + m[1];
  }

  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  log("debug", `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`);

  // Location from title pattern: "X Bedroom Y For Rent - District, City"
  const titleLocMatch = title.match(/-\s*(.+?)(?:,\s*(.+?))?$/);
  const locationFromTitle = titleLocMatch ? titleLocMatch[0].replace(/^-\s*/, "") : null;

  // Also check meta/breadcrumbs
  const breadcrumb =
    $('[class*="breadcrumb"]').text().trim() ||
    $('[class*="location"]').first().text().trim();

  const locationText = locationFromTitle || breadcrumb;
  let district = parseDistrict(locationText);
  if (!district && titleLocMatch) {
    district = parseDistrict(titleLocMatch[1]);
  }
  const city = parseCity(locationText || title, district);

  // Beds, baths, size
  const detailText = $(
    '[class*="detail"], [class*="feature"], [class*="amenity"], [class*="info"]'
  ).text();
  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Images
  const imageUrls: string[] = [];
  const imageSet = new Set<string>();

  $('img[src*="ips-cambodia"], img[src*="cloudfront"], img[data-src]').each(
    (_i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (
        src &&
        src.startsWith("http") &&
        !src.includes("logo") &&
        !src.includes("icon") &&
        !src.includes("avatar")
      ) {
        imageSet.add(src);
      }
    }
  );

  // Gallery/slider
  $(
    '[class*="gallery"] img, [class*="slider"] img, [class*="carousel"] img'
  ).each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.startsWith("http")) imageSet.add(src);
  });

  // og:image
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && ogImage.startsWith("http")) imageSet.add(ogImage);

  imageUrls.push(...imageSet);

  // Posted date from JSON-LD
  let postedAt: Date | null = null;
  const jsonLd = $('script[type="application/ld+json"]').first().html();
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd);
      if (data.datePosted) postedAt = new Date(data.datePosted);
    } catch {
      /* ignore */
    }
  }

  return {
    sourceListingId: extractListingId(url),
    title,
    description,
    city,
    district,
    propertyType,
    bedrooms,
    bathrooms,
    sizeSqm,
    priceOriginal: priceText,
    priceMonthlyUsd,
    currency: "USD",
    imageUrls,
    amenities: parseAmenities(`${title} ${description ?? ""}`),
    postedAt,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("ips-cambodia.com") &&
      u.pathname.includes("/listing-details/") &&
      /\/\d+-.+\/$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function extractListingId(url: string): string | null {
  const match = url.match(/listing-details\/(?:rental|commercial)\/(\d+)-/);
  return match ? match[1] : null;
}
