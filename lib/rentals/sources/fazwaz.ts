/**
 * FazWaz source adapter for rental listings.
 *
 * Feature-rich site with sangkat-level location data, structured beds/baths/sqm.
 *
 * Discover: fetches paginated search results (30/page, ~11 pages).
 * ScrapeListing: fetches individual listing pages.
 *
 * Category URL:
 *   /property-for-rent/cambodia?type=apartment,condo&order_by=rank|asc
 *
 * Listing URL pattern:
 *   /property-rent/{slug}-u{unit_id}
 *
 * Location format (in cards + detail pages):
 *   "Tuol Svay Prey Ti Muoy, Chamkar Mon, Phnom Penh, Cambodia"
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

const CATEGORY_BASE =
  "https://www.fazwaz-kh.com/property-for-rent/cambodia";
const CATEGORY_PARAMS = "type=apartment,condo&order_by=rank|asc";

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

export async function discoverFazWaz(
  log: PipelineLogFn = noopLogger
): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  let pagesVisited = 0;
  let pageNum = 1;

  while (
    pagesVisited < DISCOVER_MAX_PAGES &&
    urls.length < DISCOVER_MAX_URLS
  ) {
    // FazWaz pagination: /property-for-rent/cambodia/page-2?type=apartment,condo&order_by=rank|asc
    const pageUrl =
      pageNum === 1
        ? `${CATEGORY_BASE}?${CATEGORY_PARAMS}`
        : `${CATEGORY_BASE}/page-${pageNum}?${CATEGORY_PARAMS}`;

    pagesVisited++;
    log("info", `Fetching page ${pagesVisited}: ${pageUrl}`);

    const html = await fetchHtml(pageUrl);
    if (!html) {
      log("warn", `No HTML returned for ${pageUrl}`);
      break;
    }

    const $ = cheerio.load(html);
    const beforeCount = urls.length;

    // FazWaz listing links: /property-rent/{slug}-u{unit_id}
    $('a[href*="/property-rent/"]').each((_i, el) => {
      if (urls.length >= DISCOVER_MAX_URLS) return false;

      const href = $(el).attr("href");
      if (!href) return;

      const full = href.startsWith("http")
        ? href
        : `https://www.fazwaz-kh.com${href}`;

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

  log(
    "info",
    `Discovery complete: ${urls.length} unique URLs from ${pagesVisited} pages`
  );
  return urls;
}

/* ── Scrape individual listing ───────────────────────────── */

export async function scrapeListingFazWaz(
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
  const title = $("h1").first().text().trim();
  if (!title) {
    log("warn", `No title found on page: ${url}`);
    return null;
  }
  log("debug", `Title: ${title}`);

  // Description
  const description =
    $(
      ".description, [class*='description'], .property-description, .listing-desc"
    )
      .first()
      .text()
      .trim() || null;

  // Classify
  const propertyType = classifyPropertyType(title, description);
  if (!shouldIngest(propertyType)) {
    log("debug", `Skipping: classified as ${propertyType}`);
    return null;
  }

  // Price — FazWaz shows "฿XX,XXX/mo" or "$X,XXX/mo" in the detail page
  let priceText: string | null = null;

  // Look for price element
  const priceEl = $(
    "[class*='price'], .unit-price, .rental-price, [data-price]"
  ).first();
  if (priceEl.length) {
    priceText = priceEl.text().trim();
  }

  // Also look for structured data in data attributes
  if (!priceText) {
    const dataPrice = $("[data-price]").first().attr("data-price");
    if (dataPrice) priceText = "$" + dataPrice;
  }

  // Fallback: body text scan
  if (!priceText) {
    const bodyText = $("body").text();
    const m = bodyText.match(
      /(?:\$|USD)\s*([\d,]+)\s*(?:\/?\s*(?:month|mo))/i
    );
    if (m) priceText = "$" + m[1];
  }

  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  log(
    "debug",
    `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`
  );

  // Location — FazWaz has excellent location data
  // Pattern: "Sangkat, Khan, City, Cambodia"
  const locationEl = $(
    "[class*='location'], .address, .property-location, [class*='address']"
  ).first();
  const locationText = locationEl.length
    ? locationEl.text().trim()
    : "";

  // Also check breadcrumbs or structured location
  const breadcrumbText = $("[class*='breadcrumb']").text().trim();
  const fullLocationText =
    locationText || breadcrumbText || title;

  const city = parseCity(fullLocationText);
  const district = parseDistrict(fullLocationText);

  // Beds, baths, size — FazWaz shows these in structured elements
  const detailText = $(
    "[class*='detail'], [class*='feature'], [class*='spec'], [class*='amenity'], [class*='info']"
  ).text();

  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Images — FazWaz uses gallery/slider
  const imageSet = new Set<string>();

  $(
    "img[src], img[data-src], img[data-lazy-src]"
  ).each((_i, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src");
    if (
      src &&
      src.startsWith("http") &&
      (src.includes("fazwaz") ||
        src.includes("cloudfront") ||
        src.includes("amazonaws")) &&
      !src.includes("logo") &&
      !src.includes("icon") &&
      !src.includes("avatar") &&
      !src.includes("flag") &&
      !src.includes("agent")
    ) {
      imageSet.add(src);
    }
  });

  // og:image
  $('meta[property="og:image"]').each((_i, el) => {
    const content = $(el).attr("content");
    if (content && content.startsWith("http")) imageSet.add(content);
  });

  // JSON-LD
  let postedAt: Date | null = null;
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      if (data.datePosted) postedAt = new Date(data.datePosted);
      if (data.dateCreated && !postedAt)
        postedAt = new Date(data.dateCreated);
      // May also have images
      if (data.image && typeof data.image === "string") {
        imageSet.add(data.image);
      }
      if (Array.isArray(data.image)) {
        data.image.forEach((img: string) => {
          if (img.startsWith("http")) imageSet.add(img);
        });
      }
    } catch {
      /* ignore */
    }
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
    amenities: parseAmenities(
      `${title} ${description ?? ""} ${detailText}`
    ),
    postedAt,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("fazwaz") &&
      /\/property-rent\/.+-u\d+/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Extract the unit ID from FazWaz listing URL.
 * Pattern: /property-rent/{slug}-u{unit_id}
 */
function extractListingId(url: string): string | null {
  const m = url.match(/-u(\d+)(?:\?|$|\/)/);
  return m ? m[1] : null;
}
