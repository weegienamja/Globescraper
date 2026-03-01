/**
 * CamRealty source adapter for rental listings.
 *
 * WordPress-based site.
 * Discover: fetches category pages at /property-type/{type}/page/N/
 * ScrapeListing: parses individual property pages.
 *
 * Category URLs:
 *   /property-type/condominium/
 *   /property-type/serviced-apartment/
 *
 * Listing URL pattern:
 *   /property/{slug}/       (slug often contains an nXXXXXXX id)
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

const CATEGORY_URLS = [
  "https://camrealtyservice.com/property-type/condominium/",
  "https://camrealtyservice.com/property-type/serviced-apartment/",
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

export async function discoverCamRealty(
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
        pageNum === 1 ? baseUrl : `${baseUrl}page/${pageNum}/`;
      pagesVisited++;
      log("info", `Fetching page ${pagesVisited}: ${pageUrl}`);

      const html = await fetchHtml(pageUrl);
      if (!html) {
        log("warn", `No HTML returned for ${pageUrl}`);
        break;
      }

      const $ = cheerio.load(html);
      const beforeCount = urls.length;

      // CamRealty cards link to /property/{slug}/
      $('a[href*="/property/"]').each((_i, el) => {
        if (urls.length >= DISCOVER_MAX_URLS) return false;

        const href = $(el).attr("href");
        if (!href) return;

        const full = href.startsWith("http")
          ? href
          : `https://camrealtyservice.com${href}`;

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

export async function scrapeListingCamRealty(
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

  // Title — WordPress single property title
  const title =
    $("h1.entry-title, h1.property_title, h1").first().text().trim() ||
    $("title").first().text().trim();

  if (!title) {
    log("warn", `No title found on page: ${url}`);
    return null;
  }
  log("debug", `Title: ${title}`);

  // Description
  const description =
    $(
      ".property_description, .entry-content, .property-content, [class*='description']"
    )
      .first()
      .text()
      .trim() || null;

  // Classify
  const propertyType = classifyPropertyType(title, description);
  if (!propertyType) return null; // non-residential

  // Price — CamRealty uses WordPress property fields
  let priceText: string | null = null;

  // Look for WordPress property price elements
  const priceEl = $(
    ".property_price, .price, [class*='price'], .listing-price"
  ).first();
  if (priceEl.length) {
    priceText = priceEl.text().trim();
  }

  // Fallback: page body scan
  if (!priceText) {
    const bodyText = $("body").text();
    const m = bodyText.match(/\$\s*([\d,]+)\s*\/?\s*(?:month|mo)/i);
    if (m) priceText = "$" + m[1];
  }

  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  log(
    "debug",
    `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`
  );

  // Location — address field, breadcrumbs, or title parsing
  const locationText =
    $(
      ".property_address, .property-address, .address, [class*='location']"
    )
      .first()
      .text()
      .trim() ||
    $('[class*="breadcrumb"]').text().trim();

  const district = parseDistrict(locationText || title);
  const city = parseCity(locationText || title, district);

  // Beds, baths, size — parse from detail fields + title
  const detailText = $(
    ".property_detail, .property-details, .property-meta, [class*='feature'], [class*='amenity']"
  ).text();
  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Images — WordPress gallery
  const imageSet = new Set<string>();

  $("img[src]").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (
      src &&
      src.startsWith("http") &&
      (src.includes("camrealtyservice") ||
        src.includes("wp-content") ||
        src.includes("cloudfront")) &&
      !src.includes("logo") &&
      !src.includes("icon") &&
      !src.includes("avatar") &&
      !src.includes("gravatar")
    ) {
      imageSet.add(src);
    }
  });

  $('meta[property="og:image"]').each((_i, el) => {
    const content = $(el).attr("content");
    if (content && content.startsWith("http")) imageSet.add(content);
  });

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
    imageUrls: [...imageSet],
    amenities: parseAmenities(`${title} ${description ?? ""}`),
    postedAt: null,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("camrealtyservice.com") &&
      /^\/property\/[^/]+\/?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Extract an ID from the slug. CamRealty slugs often contain "nXXXXXXX"
 * (e.g., n4512168). Falls back to the full slug as the ID.
 */
function extractListingId(url: string): string | null {
  const slugMatch = url.match(/\/property\/([^/?]+)/);
  if (!slugMatch) return null;

  const slug = slugMatch[1];
  const idMatch = slug.match(/n(\d{5,})/);
  return idMatch ? idMatch[1] : slug;
}
