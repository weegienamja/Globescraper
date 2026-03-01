/**
 * Khmer24 source adapter for rental listings.
 *
 * Uses Playwright (headless Chromium) to bypass Cloudflare WAF.
 *
 * Discover: fetches category index pages via ?page=N, extracts listing URLs.
 * ScrapeListing: fetches an individual listing page, parses fields.
 *
 * Category URLs (current site structure, Feb 2026):
 *   /en/c-apartment-for-rent   — apartments
 *   /en/c-room-for-rent        — rooms (studios, shared, etc.)
 *
 * Listing URL pattern:
 *   /en/<slug>-adid-<digits>
 */

import * as cheerio from "cheerio";
import { fetchHtmlPlaywright, fetchCategoryPagePlaywright } from "../playwright";
import { canonicalizeUrl } from "../url";
import { classifyPropertyType, shouldIngest } from "../classify";
import { parsePriceMonthlyUsd, parseBedsBathsSize, parseDistrict, parseCity, parseAmenities } from "../parse";
import { DISCOVER_MAX_PAGES, DISCOVER_MAX_URLS } from "../config";
import type { PropertyType } from "@prisma/client";

import type { PipelineLogFn } from "../pipelineLogger";
import { politeDelay } from "../http";

/* ── Category URLs ───────────────────────────────────────── */

const CATEGORY_URLS = [
  "https://www.khmer24.com/en/c-apartment-for-rent",
  "https://www.khmer24.com/en/c-room-for-rent",
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

/**
 * Discover listing URLs from Khmer24 category pages.
 * Uses `?page=N` pagination (50 listings per page).
 */
export async function discoverKhmer24(log?: PipelineLogFn): Promise<DiscoveredUrl[]> {
  const noopLog: PipelineLogFn = () => {};
  const _log = log ?? noopLog;

  const seen = new Set<string>();
  const urls: DiscoveredUrl[] = [];
  let pagesVisited = 0;

  for (const baseUrl of CATEGORY_URLS) {
    if (pagesVisited >= DISCOVER_MAX_PAGES || urls.length >= DISCOVER_MAX_URLS) break;

    _log("info", `Crawling category: ${baseUrl}`);
    let pageNum = 1;

    while (pagesVisited < DISCOVER_MAX_PAGES && urls.length < DISCOVER_MAX_URLS) {
      const pageUrl = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;
      pagesVisited++;
      _log("debug", `  Page ${pageNum}: ${pageUrl}`);

      const html = await fetchCategoryPagePlaywright(pageUrl, 0);
      if (!html) {
        _log("warn", `  No HTML returned for ${pageUrl}`);
        break;
      }

      const $ = cheerio.load(html);
      let newOnThisPage = 0;

      // Khmer24 listing links follow /en/<slug>-adid-<digits>
      $("a[href]").each((_i, el) => {
        if (urls.length >= DISCOVER_MAX_URLS) return false;

        const href = $(el).attr("href");
        if (!href) return;

        const full = href.startsWith("http")
          ? href
          : `https://www.khmer24.com${href}`;

        if (!isListingUrl(full)) return;

        const canonical = canonicalizeUrl(full);
        if (seen.has(canonical)) return;
        seen.add(canonical);

        urls.push({
          url: canonical,
          sourceListingId: extractListingId(full),
        });
        newOnThisPage++;
      });

      _log("debug", `  Found ${newOnThisPage} new listing URLs (total: ${urls.length})`);

      // If no new listings were found, we've exhausted this category
      if (newOnThisPage === 0) {
        _log("info", `  No more listings on page ${pageNum} — moving on`);
        break;
      }

      pageNum++;
      await politeDelay();
    }
  }

  _log("info", `Discover complete: ${urls.length} URLs from ${pagesVisited} pages`);
  return urls;
}

/* ── Scrape individual listing ───────────────────────────── */

/**
 * Scrape a single Khmer24 listing page and extract structured data.
 * Returns null if the page cannot be fetched or parsed.
 *
 * DOM structure (as of Feb 2026):
 *   article > header — images, title, price, location badge
 *   article > section — description, dt/dd spec grid
 *   Price: p.text-error-500 or bold text with $ in the header
 *   Specs: dt (label) + dd (value) pairs — Bedroom, Bathroom, Size, Category
 *   Location: <p class="flex gap-x-1 items-center"> with <span class="...p-location..."> icon
 *            Fallback: page <title> "... price $X in Sangkat, District, City, Cambodia - ..."
 *   Images: a[data-fancybox="gallery"] img (full-size links)
 */
export async function scrapeListingKhmer24(
  url: string,
  log?: PipelineLogFn
): Promise<ScrapedListing | null> {
  const noopLog: PipelineLogFn = () => {};
  const _log = log ?? noopLog;

  _log("debug", `Fetching listing page: ${url}`);

  const html = await fetchHtmlPlaywright(url);
  if (!html) {
    _log("warn", `No HTML returned for listing: ${url}`);
    return null;
  }

  const $ = cheerio.load(html);

  // ── Title ──
  // Prefer h1, fall back to page <title> (format: "<title> price $X in <loc> | Khmer24.com")
  const pageTitle = $("title").text().trim();
  const h1 = $("h1").first().text().trim();
  const titleFromMeta = pageTitle.split(" price ")[0].trim();
  const title =
    h1 || titleFromMeta || $("article header img").first().attr("alt")?.trim() || "";

  if (!title) {
    _log("warn", `No title found on page: ${url}`);
    return null;
  }
  _log("debug", `Title: ${title}`);

  // ── Description ──
  const description =
    $("article section p.whitespace-break-spaces, article section [class*='text-base']")
      .first()
      .text()
      .trim() || null;

  // ── Classify property type ──
  const categoryDd = getSpecValue($, "Category");
  const classifyText = `${title} ${categoryDd ?? ""} ${description ?? ""}`;
  const propertyType = classifyPropertyType(title, classifyText);
  if (!propertyType) {
    _log("debug", `Skipped non-residential listing: ${title.slice(0, 80)}`);
    return null;
  }
  _log("debug", `Classified as: ${propertyType}`);

  // ── Price ──
  // Primary: the bold red price in the header
  let priceText =
    $("p.text-error-500, .text-error-500").first().text().trim() ||
    $("article header [class*='text-2xl']").first().text().trim() ||
    null;

  // Fallback: look for "$NNN" in the page title meta
  if (!priceText && pageTitle) {
    const m = pageTitle.match(/price\s+\$([\d,]+(?:\.\d+)?)/i);
    if (m) priceText = "$" + m[1];
  }

  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  _log("debug", `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`);

  // ── Structured specs (dt/dd grid) ──
  const bedroomSpec = getSpecValue($, "Bedroom");
  const bathroomSpec = getSpecValue($, "Bathroom");
  const sizeSpec = getSpecValue($, "Size");

  // ── Beds / Baths / Size — combine specs + title + description ──
  const detailText = `${bedroomSpec ?? ""} bedroom ${bathroomSpec ?? ""} bathroom ${sizeSpec ?? ""} ${title} ${description ?? ""}`;
  let { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(detailText);

  // Override with structured values if present
  if (bedroomSpec && !bedrooms) {
    const n = parseInt(bedroomSpec, 10);
    if (n > 0 && n < 20) bedrooms = n;
  }
  if (bathroomSpec && !bathrooms) {
    const n = parseInt(bathroomSpec, 10);
    if (n > 0 && n < 20) bathrooms = n;
  }
  if (sizeSpec && !sizeSqm) {
    const m = sizeSpec.match(/(\d+(?:\.\d+)?)\s*m/);
    if (m) sizeSqm = parseFloat(m[1]);
  }

  _log("debug", `Specs: ${bedrooms ?? "?"}BR / ${bathrooms ?? "?"}BA / ${sizeSqm ?? "?"}m²`);

  // ── Location ──
  // Primary: <p class="flex gap-x-1 items-center"> containing
  //   <span class="iconify i-k24:p-location-outline"> → parent text is "District, City"
  // Fallback 1: page <title> format: "... price $X in Sangkat, District, City, Cambodia - ..."
  // Fallback 2: listing title text with "in <location>" pattern
  let locationText: string | null = null;

  // Strategy 1: Location icon <p> element (most reliable)
  $("span[class*='p-location']").each((_i, el) => {
    if (locationText) return;
    const parent = $(el).parent();
    if (parent.is("p")) {
      const text = parent.text().trim();
      if (text && text.length < 100) {
        locationText = text;
      }
    }
  });
  _log("debug", `Location (icon selector): ${locationText ?? "not found"}`);

  // Strategy 2: Parse from page <title> tag
  // Format: "<title> price $X in <Sangkat>, <District>, <City>, Cambodia - <Seller> | Khmer24.com"
  if (!locationText) {
    const titleLocMatch = pageTitle.match(/price\s+\$[\d,.]+\s+in\s+(.+?)\s*-\s*/i);
    if (titleLocMatch) {
      locationText = titleLocMatch[1].trim().replace(/,\s*Cambodia$/i, "").trim();
      _log("debug", `Location (from title): ${locationText}`);
    }
  }

  // Strategy 3: Old .date-location fallback (less reliable but still present)
  if (!locationText) {
    const dateLoc = $(".date-location").first();
    let dateLocLine = "";
    dateLoc.contents().each((_i, node) => {
      if (dateLocLine) return;
      const t = $(node).text().trim();
      if (t && t.includes("•")) dateLocLine = t;
    });
    if (!dateLocLine) {
      dateLocLine = dateLoc.text().trim().split(/\n/)[0].replace(/\s+/g, " ").trim();
    }
    dateLocLine = dateLocLine.replace(/(?:Rent|Used|New|Sale)(?:\s*•.*)?$/i, "").trim();
    const locMatch = dateLocLine.match(/•\s*(.+)/);
    if (locMatch) {
      locationText = locMatch[1].trim();
      _log("debug", `Location (date-location fallback): ${locationText}`);
    }
  }

  let city = parseCity(locationText || title);
  let district = parseDistrict(locationText);
  if (!district) {
    const titleMatch = title.match(/(?:in|at)\s+(.+?)(?:\s*[-|]|$)/i);
    if (titleMatch) {
      district = parseDistrict(titleMatch[1].trim());
    }
  }
  // Re-derive city using district fallback
  city = parseCity(locationText || title, district);
  _log("debug", `Location: ${district ?? "unknown"}, ${city}`);

  // ── Images ──
  const imageUrls: string[] = [];
  const imageSet = new Set<string>();

  // Full-size gallery links
  $('a[data-fancybox="gallery"]').each((_i, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http") && href.includes("khmer24")) {
      imageSet.add(href);
    }
  });

  // Header images (non-thumbnail)
  $("article header img").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (
      src &&
      src.startsWith("http") &&
      src.includes("khmer24") &&
      !src.includes("/s-") // skip small thumbnails
    ) {
      imageSet.add(src);
    }
  });

  imageUrls.push(...imageSet);
  _log("debug", `Found ${imageUrls.length} images`);

  // ── Posted date ──
  // Try multiple strategies:
  // 1. Look for ISO-style date in the page body (e.g. "2026-02-27 08:19:45")
  // 2. Fall back to .date-location "2d • ..." relative date format
  let postedAt: Date | null = null;

  // Strategy 1: Look for a date-like <p> with a clock/time icon
  $("p.flex span[class*='p-time'], p.flex span[class*='clock']").each((_i, el) => {
    if (postedAt) return;
    const parent = $(el).parent();
    const text = parent.text().trim();
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
    if (isoMatch) {
      const d = new Date(isoMatch[1]);
      if (!isNaN(d.getTime())) postedAt = d;
    }
  });

  // Strategy 2: Parse from .date-location relative time ("2d •", "6h •")
  if (!postedAt) {
    const dateLoc = $(".date-location").first();
    let dateLocText = "";
    dateLoc.contents().each((_i, node) => {
      if (dateLocText) return;
      const t = $(node).text().trim();
      if (t && t.includes("•")) dateLocText = t;
    });
    if (!dateLocText) {
      dateLocText = dateLoc.text().trim().split(/\n/)[0].replace(/\s+/g, " ").trim();
    }
    postedAt = parsePostedDate(dateLocText);
  }

  // ── Source ID ──
  const sourceListingId = extractListingId(url);

  return {
    sourceListingId,
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

/**
 * Check whether a URL looks like a Khmer24 listing page.
 * Current pattern: /en/<slug>-adid-<digits>
 */
function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("khmer24.com") &&
      /\/en\/.+-adid-\d+$/.test(u.pathname) &&
      !u.pathname.includes("/search") &&
      !u.pathname.includes("/c-")
    );
  } catch {
    return false;
  }
}

/**
 * Extract the numeric listing ID from a Khmer24 URL.
 * E.g. /en/some-title-adid-12345 → "12345"
 */
function extractListingId(url: string): string | null {
  const match = url.match(/adid-(\d+)/);
  return match ? match[1] : null;
}

/**
 * Read a structured spec value from the dt/dd grid.
 * Khmer24 renders specs as adjacent <dt> label / <dd> value pairs.
 */
function getSpecValue($: cheerio.CheerioAPI, label: string): string | null {
  let result: string | null = null;
  $("dt").each((_i, el) => {
    if ($(el).text().trim().toLowerCase() === label.toLowerCase()) {
      const dd = $(el).next("dd");
      if (dd.length) {
        result = dd.text().trim() || null;
      }
    }
  });
  return result;
}

/**
 * Parse a posted date from the date-location text.
 *
 * Formats seen:
 *   "6h • Boeng Keng Kang, Phnom Penh"   → 6 hours ago
 *   "2d • BKK, Phnom Penh"               → 2 days ago
 *   "3w • ..."                            → 3 weeks ago
 *   "Feb 11 • ..."                        → Feb 11 of current year
 *   "Oct 21 2024 • ..."                   → Oct 21 2024
 */
function parsePostedDate(dateLocationText: string): Date | null {
  if (!dateLocationText) return null;

  // The date portion is before the first bullet "•"
  const datePart = dateLocationText.split("•")[0].trim();
  if (!datePart) return null;

  const now = new Date();

  // Relative: "6h", "2d", "3w", "1m"
  const relMatch = datePart.match(/^(\d+)\s*(h|d|w|m)$/i);
  if (relMatch) {
    const n = parseInt(relMatch[1]);
    const unit = relMatch[2].toLowerCase();
    switch (unit) {
      case "h":
        return new Date(now.getTime() - n * 3_600_000);
      case "d":
        return new Date(now.getTime() - n * 86_400_000);
      case "w":
        return new Date(now.getTime() - n * 7 * 86_400_000);
      case "m":
        return new Date(now.getTime() - n * 30 * 86_400_000);
    }
  }

  // Absolute: "Feb 11" or "Oct 21 2024"
  const absMatch = datePart.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(\d{4}))?$/i
  );
  if (absMatch) {
    const monthStr = absMatch[1];
    const day = parseInt(absMatch[2]);
    const year = absMatch[3] ? parseInt(absMatch[3]) : now.getFullYear();
    const d = new Date(`${monthStr} ${day}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Last-ditch: try native Date parsing
  const d = new Date(datePart);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

  return null;
}
