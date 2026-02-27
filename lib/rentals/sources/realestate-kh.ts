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
import { parsePriceMonthlyUsd, parseBedsBathsSize, parseDistrict, parseCity } from "../parse";
import { DISCOVER_MAX_PAGES, DISCOVER_MAX_URLS } from "../config";
import type { PropertyType } from "@prisma/client";
import { type PipelineLogFn, noopLogger } from "../pipelineLogger";

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
  postedAt: Date | null;
}

/* ── Discover ────────────────────────────────────────────── */

/**
 * Discover listing URLs from realestate.com.kh category pages.
 * Respects DISCOVER_MAX_PAGES and DISCOVER_MAX_URLS caps.
 */
export async function discoverRealestateKh(log: PipelineLogFn = noopLogger): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  let pagesVisited = 0;

  for (const baseUrl of CATEGORY_URLS) {
    if (pagesVisited >= DISCOVER_MAX_PAGES) break;
    log("info", `Scanning category: ${baseUrl}`);

    let pageUrl: string | null = baseUrl;

    while (pageUrl && pagesVisited < DISCOVER_MAX_PAGES && urls.length < DISCOVER_MAX_URLS) {
      pagesVisited++;
      log("info", `Fetching page ${pagesVisited}: ${pageUrl}`);
      const html = await fetchHtml(pageUrl);
      if (!html) {
        log("warn", `No HTML returned for ${pageUrl}`);
        break;
      }

      const $ = cheerio.load(html);
      const beforeCount = urls.length;

      // Extract listing links from article elements (each listing is an <article>)
      $("article a[href]").each((_i, el) => {
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
          log("debug", `Found listing: ${canonical}`, { id: sourceId });
        }
      });

      // Also pick up links from .info.listing containers
      $("div.info.listing a[href]").each((_i, el) => {
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
          log("debug", `Found listing: ${canonical}`, { id: sourceId });
        }
      });

      const pageFound = urls.length - beforeCount;
      log("info", `Page ${pagesVisited}: found ${pageFound} new listing links (total: ${urls.length})`);

      // Find next page link — realestate.com.kh uses ?page=N
      let nextPageUrl: string | null = null;
      $("a[href]").each((_i, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        // Look for "next" link or numbered page links
        if (text === "›" || text === "Next" || text === "»") {
          nextPageUrl = href.startsWith("http")
            ? href
            : `https://www.realestate.com.kh${href}`;
          return false;
        }
      });

      // Fallback: try incrementing ?page=N
      if (!nextPageUrl) {
        const currentUrl = new URL(pageUrl);
        const currentPage = parseInt(currentUrl.searchParams.get("page") || "1", 10);
        // Only try next page if we found listings on this page
        if (urls.length > 0 && currentPage < DISCOVER_MAX_PAGES) {
          const paginatedUrl: URL = new URL(pageUrl as string);
          paginatedUrl.searchParams.set("page", String(currentPage + 1));
          nextPageUrl = paginatedUrl.toString();
        }
      }

      if (nextPageUrl && nextPageUrl !== pageUrl) {
        log("info", `Pagination: moving to ${nextPageUrl}`);
        pageUrl = nextPageUrl;
      } else {
        log("info", `No more pages for this category`);
        pageUrl = null;
      }

      await politeDelay();
    }
  }

  log("info", `Discovery complete: ${urls.length} unique URLs from ${pagesVisited} pages`);
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
    $('[class*="description"], .listing-description, .property-description')
      .first()
      .text()
      .trim() || null;

  // Classify
  const propertyType = classifyPropertyType(title, description);
  if (!shouldIngest(propertyType)) {
    log("debug", `Skipping: classified as ${propertyType} (not condo/apartment)`);
    return null;
  }
  log("debug", `Classified as: ${propertyType}`);

  // Price
  const priceText =
    $('[class*="price"], .listing-price').first().text().trim() || null;
  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  log("debug", `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`);

  // Location — try multiple selectors, then fallback to URL slug
  const locationText =
    $('[class*="location"], .listing-location, .address, [class*="breadcrumb"]')
      .first()
      .text()
      .trim() || null;

  // Extract city from breadcrumb / location text (defaults to Phnom Penh)
  const city = parseCity(locationText || title);
  log("debug", `City: ${city}`);

  let district = parseDistrict(locationText);

  // Fallback: extract district from title (e.g. "3 Bed, 4 Bath Apartment for Rent in BKK 1")
  if (!district) {
    const titleMatch = title.match(/(?:in|at)\s+(.+?)$/i);
    if (titleMatch) {
      district = parseDistrict(titleMatch[1].trim());
      if (!district) district = titleMatch[1].trim();
    }
  }

  // Fallback: extract from URL slug (e.g. /rent/bkk-1/... → "BKK 1")
  if (!district) {
    district = extractDistrictFromUrl(url);
  }

  // Beds, baths, size
  const detailText = $(
    '[class*="detail"], [class*="feature"], .amenities, .listing-info'
  ).text();
  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Size: also try to find "floor area" or "m²" in specific elements
  let finalSizeSqm = sizeSqm;
  if (!finalSizeSqm) {
    const sizeMatch = $.html().match(/(\d+)\s*m²/i);
    if (sizeMatch) finalSizeSqm = parseFloat(sizeMatch[1]);
  }

  // Images — try multiple selectors and also look for og:image and srcset
  const imageUrls: string[] = [];
  const imageSet = new Set<string>();

  // Try og:image first
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && ogImage.startsWith("http")) {
    imageSet.add(ogImage);
  }

  // Try all img tags with common listing image patterns
  $('img[src*="realestate"], img[src*="cloudfront"], img[src*="cdn"], img[data-src]').each(
    (_i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http") && !src.includes("logo") && !src.includes("icon") && !src.includes("avatar")) {
        imageSet.add(src);
      }
    }
  );

  // Also try gallery/slider containers
  $('[class*="gallery"] img, [class*="slider"] img, [class*="carousel"] img, [class*="photo"] img').each(
    (_i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http")) {
        imageSet.add(src);
      }
    }
  );

  imageUrls.push(...imageSet);
  log("debug", `Found ${imageUrls.length} images`);

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
    city,
    district,
    propertyType,
    bedrooms,
    bathrooms,
    sizeSqm: finalSizeSqm,
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
    if (!u.hostname.includes("realestate.com.kh")) return false;

    const path = u.pathname;

    // Individual listing pages have a numeric ID at the end of the slug:
    // /rent/<district>/<beds>-bed-<baths>-bath-<type>-<id>/
    // /new-developments/<project>/<beds>-bed-<baths>-bath-<type>-<id>/
    // The ID is always a 5-6 digit number at the end
    if (/\d{5,}\/?\s*$/.test(path)) {
      // Must contain "rent" or "new-developments" in the path
      if (path.includes("/rent/") || path.includes("/new-developments/")) {
        // Exclude category/filter pages (those don't have numeric IDs)
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function extractListingId(url: string): string | null {
  // Extract numeric ID from end of URL path
  // e.g. /rent/bkk-1/3-bed-4-bath-apartment-259490/ → "259490"
  const match = url.match(/-(\d{5,})\/?(?:[?#]|$)/);
  return match ? match[1] : null;
}

/**
 * Extract district name from URL slug.
 * /rent/bkk-1/... → "BKK 1"
 * /rent/tonle-bassac/... → "Tonle Bassac"
 */
function extractDistrictFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    // For /rent/<district>/<listing-slug>, district is segments[1]
    if (segments[0] === "rent" && segments.length >= 3) {
      const slug = segments[1];
      // Convert slug to display name: "bkk-1" → "BKK 1", "tonle-bassac" → "Tonle Bassac"
      if (slug.startsWith("bkk")) {
        return slug.replace(/-/g, " ").toUpperCase();
      }
      return slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return null;
  } catch {
    return null;
  }
}
