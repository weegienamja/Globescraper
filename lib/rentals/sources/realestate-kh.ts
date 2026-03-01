/**
 * Realestate.com.kh source adapter for rental listings.
 *
 * Discover: uses the internal JSON API at /api/portal/pages/results/
 * to paginate through residential rental categories.
 * ScrapeListing: fetches an individual listing page, parses fields.
 *
 * The site is a Next.js SPA — HTML pages don't paginate with ?page=N.
 * The JSON API is the only reliable way to discover listings.
 */

import * as cheerio from "cheerio";
import { fetchHtml, politeDelay } from "../http";
import { canonicalizeUrl } from "../url";
import { classifyPropertyType } from "../classify";
import { parsePriceMonthlyUsd, parseBedsBathsSize, parseDistrict, parseCity, parseAmenities } from "../parse";
import { USER_AGENT } from "../config";
import type { PropertyType } from "@prisma/client";
import { type PipelineLogFn, noopLogger } from "../pipelineLogger";

/* ── API constants ───────────────────────────────────────── */

const API_BASE = "https://www.realestate.com.kh/api/portal/pages/results/";
const API_PAGE_SIZE = 100;
const API_MAX_PAGE = 50;
const ORIGIN = "https://www.realestate.com.kh";

/**
 * Category API pathnames for residential property types.
 * - /rent/condo/ returns the same results as /rent/apartment/ (deduplicated)
 * - /rent/townhouse/ is not a valid API pathname (included in house results)
 */
const CATEGORY_PATHNAMES = [
  { pathname: "/rent/apartment/", label: "apartment" },
  { pathname: "/rent/serviced-apartment/", label: "serviced-apartment" },
  { pathname: "/rent/penthouse/", label: "penthouse" },
  { pathname: "/rent/house/", label: "house" },
  { pathname: "/rent/villa/", label: "villa" },
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

/* ── API types ───────────────────────────────────────────── */

interface ApiListingResult {
  id: number;
  url: string;
  headline: string;
  nested?: ApiListingResult[];
}

interface ApiPageResponse {
  count: number;
  last_page: number;
  results: ApiListingResult[];
}

/* ── API fetch helper ────────────────────────────────────── */

async function fetchApiPage(
  pathname: string,
  page: number,
  log: PipelineLogFn
): Promise<ApiPageResponse | null> {
  const qs = new URLSearchParams({
    pathname,
    page_size: String(API_PAGE_SIZE),
    page: String(page),
    search_languages: "en",
    order_by: "date-desc",
  });
  const url = `${API_BASE}?${qs}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const resp = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Accept-Language": "en",
          "Accept-Currency": "usd",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 400) return null;
        if (attempt < 2 && (resp.status === 429 || resp.status >= 500)) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return null;
      }
      return (await resp.json()) as ApiPageResponse;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      log("error", `API fetch failed: ${url}`);
      return null;
    }
  }
  return null;
}

/* ── Discover ────────────────────────────────────────────── */

/**
 * Discover listing URLs from realestate.com.kh using the JSON API.
 * Paginates each residential category up to 50 pages × 100 results = 5,000 per category.
 * Uses dual sort order (date-desc + date-asc) for categories > 5,000 to maximize coverage.
 */
export async function discoverRealestateKh(log: PipelineLogFn = noopLogger): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  let apiCalls = 0;

  for (const cat of CATEGORY_PATHNAMES) {
    log("info", `Scanning category: ${cat.label}`);

    const firstPage = await fetchApiPage(cat.pathname, 1, log);
    apiCalls++;
    if (!firstPage || firstPage.results.length === 0) {
      log("warn", `No results for ${cat.label}`);
      await politeDelay();
      continue;
    }

    const total = firstPage.count;
    const maxPages = Math.min(API_MAX_PAGE, Math.ceil(total / API_PAGE_SIZE));
    log("info", `[${cat.label}] ${total} listings, paginating up to ${maxPages} pages`);

    // Extract from first page
    for (const result of firstPage.results) {
      addResult(result, seen, urls);
    }

    // Remaining pages
    for (let page = 2; page <= maxPages; page++) {
      await politeDelay();
      const resp = await fetchApiPage(cat.pathname, page, log);
      apiCalls++;
      if (!resp || resp.results.length === 0) break;
      for (const result of resp.results) {
        addResult(result, seen, urls);
      }
      if (page % 10 === 0) {
        log("info", `[${cat.label}] page ${page}/${maxPages}: ${urls.length} total URLs`);
      }
    }

    log("info", `[${cat.label}] done — ${urls.length} unique URLs so far`);
  }

  log("info", `Discovery complete: ${urls.length} unique URLs from ${apiCalls} API calls`);
  return urls;
}

function addResult(result: ApiListingResult, seen: Set<string>, out: DiscoveredUrl[]): void {
  if (result.url) {
    const full = result.url.startsWith("http") ? result.url : `${ORIGIN}${result.url}`;
    const canonical = canonicalizeUrl(full);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      out.push({ url: canonical, sourceListingId: extractListingId(full) ?? String(result.id) });
    }
  }
  if (result.nested) {
    for (const nested of result.nested) {
      addResult(nested, seen, out);
    }
  }
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

  // Classify — use title + description + URL slug for best accuracy
  // The URL slug on realestate.com.kh often contains the type:
  // e.g. /rent/bkk-1/3-bed-4-bath-villa-259490/
  const urlSlug = url.toLowerCase();
  const classifyHint = `${title} ${description ?? ""} ${urlSlug}`;
  const propertyType = classifyPropertyType(classifyHint);

  // Reject non-residential listings
  if (!propertyType) {
    log("debug", `Skipped non-residential listing: ${title.slice(0, 80)}`);
    return null;
  }
  log("debug", `Classified as: ${propertyType}`);

  // Price — intelligently extract the RENTAL price, not the sale price.
  // realestate.com.kh shows both "For sale $X" and "For rent $Y" on dual-listed
  // properties. We must pick the rental price only.
  let priceText: string | null = null;

  // Strategy 1: Look for structured price blocks labeled as "rent".
  // Two patterns on the site:
  //   .prices > .price  with  .prefix  ("For sale" / "For rent")
  //   .price-section > .price-row  with  .price-title  ("Sale price" / "Rent per month")
  $(".prices .price, .price-section .price-row").each((_i, el) => {
    if (priceText) return; // already found rental price
    const label = $(el).find(".prefix, .price-title").text().toLowerCase();
    if (label.includes("rent") || label.includes("per month")) {
      const m = $(el).text().match(/\$([\d,]+)/);
      if (m) priceText = "$" + m[1];
    }
  });

  // Strategy 2: Check the description for an explicit rent price
  // e.g. "Price: $350/month for rent"
  if (!priceText && description) {
    const m = description.match(/\$([\d,]+)\s*\/?\s*(?:month|mo)\b/i);
    if (m) priceText = "$" + m[1];
  }

  // Strategy 3: For /rent/ URLs (definitely rental listings), fall back to
  // the first price element — these pages always show the rental price.
  if (!priceText && url.includes("/rent/")) {
    priceText =
      $('[class*="price"], .listing-price').first().text().trim() || null;
  }

  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  log(
    "debug",
    `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`
  );

  // Location — try multiple selectors, then fallback to URL slug
  const locationText =
    $('[class*="location"], .listing-location, .address, [class*="breadcrumb"]')
      .first()
      .text()
      .trim() || null;

  // Extract city from breadcrumb / location text (defaults to Phnom Penh)
  let city = parseCity(locationText || title);
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

  // Re-derive city using district as fallback (catches Sihanoukville-district-under-PP etc.)
  if (city === "Phnom Penh") {
    city = parseCity(locationText || title, district);
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
    amenities: parseAmenities(`${title} ${description ?? ""}`),
    postedAt,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

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
