/**
 * LongTermLettings source adapter for rental listings.
 *
 * Small site with ~37 listings in Cambodia (single page).
 *
 * Discover: fetches the single category page.
 * ScrapeListing: fetches an individual listing page, parses fields.
 *
 * Category URL:
 *   /rent/monthly/cambodia/
 *
 * Listing URL pattern:
 *   /r/rent/hms_{id}/
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
import { DISCOVER_MAX_URLS } from "../config";
import type { PropertyType } from "@prisma/client";
import { type PipelineLogFn, noopLogger } from "../pipelineLogger";

/* ── Category URLs ───────────────────────────────────────── */

const CATEGORY_URLS = [
  "https://www.longtermlettings.com/rent/monthly/cambodia/",
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

/* ── Discover ────────────────────────────────────────────── */

export async function discoverLongTermLettings(
  log: PipelineLogFn = noopLogger
): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = [];
  const seen = new Set<string>();

  for (const categoryUrl of CATEGORY_URLS) {
    log("info", `Scanning category: ${categoryUrl}`);

    const html = await fetchHtml(categoryUrl);
    if (!html) {
      log("warn", `No HTML returned for ${categoryUrl}`);
      continue;
    }

    const $ = cheerio.load(html);

    // LongTermLettings listing links: /r/rent/hms_{id}/
    $('a[href*="/r/rent/hms_"]').each((_i, el) => {
      if (urls.length >= DISCOVER_MAX_URLS) return false;

      const href = $(el).attr("href");
      if (!href) return;

      const full = href.startsWith("http")
        ? href
        : `https://www.longtermlettings.com${href}`;

      if (!isListingUrl(full)) return;

      const canonical = canonicalizeUrl(full);
      if (seen.has(canonical)) return;
      seen.add(canonical);

      urls.push({
        url: canonical,
        sourceListingId: extractListingId(full),
      });
    });

    log("info", `Found ${urls.length} listings on ${categoryUrl}`);

    // Check if there are additional pages
    const nextLink = $('a[href*="cambodia/"][rel="next"], a.next, a:contains("Next")').attr("href");
    if (nextLink) {
      log("info", `Found pagination link: ${nextLink} — fetching additional pages`);
      let pageUrl = nextLink.startsWith("http")
        ? nextLink
        : `https://www.longtermlettings.com${nextLink}`;
      let pageCount = 1;

      while (pageUrl && pageCount < 10 && urls.length < DISCOVER_MAX_URLS) {
        pageCount++;
        await politeDelay();
        const pageHtml = await fetchHtml(pageUrl);
        if (!pageHtml) break;

        const $p = cheerio.load(pageHtml);

        $p('a[href*="/r/rent/hms_"]').each((_i, el) => {
          if (urls.length >= DISCOVER_MAX_URLS) return false;
          const h = $p(el).attr("href");
          if (!h) return;
          const f = h.startsWith("http")
            ? h
            : `https://www.longtermlettings.com${h}`;
          if (!isListingUrl(f)) return;
          const c = canonicalizeUrl(f);
          if (seen.has(c)) return;
          seen.add(c);
          urls.push({ url: c, sourceListingId: extractListingId(f) });
        });

        const next = $p('a[href*="cambodia/"][rel="next"], a.next, a:contains("Next")').attr("href");
        pageUrl = next
          ? next.startsWith("http")
            ? next
            : `https://www.longtermlettings.com${next}`
          : "";
      }
    }
  }

  log("info", `Discovery complete: ${urls.length} unique URLs`);
  return urls;
}

/* ── Scrape individual listing ───────────────────────────── */

export async function scrapeListingLongTermLettings(
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

  // LongTermLettings titles often look like: "Phnom-Penh Room for rent"
  // City is usually the first word(s)

  // Description
  const description =
    $(
      ".property-description, .listing-description, [class*='description'], .detail-description"
    )
      .first()
      .text()
      .trim() || null;

  // Classify
  const propertyType = classifyPropertyType(title, description);
  if (!propertyType) return null; // non-residential

  // Price — "$450 USD" pattern
  let priceText: string | null = null;

  // Check card text and heading area
  const priceEl = $(
    "[class*='price'], .rate, .rental-rate, .cost"
  ).first();
  if (priceEl.length) {
    priceText = priceEl.text().trim();
  }

  // Fallback: scan for dollar amounts in the page
  if (!priceText) {
    const bodyText = $("body").text();
    const m = bodyText.match(
      /\$\s*([\d,]+)\s*(?:USD|usd)?\s*(?:\/?\s*(?:month|mo|pcm))?/i
    );
    if (m) priceText = "$" + m[1];
  }

  const priceMonthlyUsd = parsePriceMonthlyUsd(priceText);
  log(
    "debug",
    `Price: ${priceText ?? "not found"} → $${priceMonthlyUsd ?? "N/A"}/mo`
  );

  // Location from title: "Phnom-Penh Room for rent" → city = "Phnom Penh"
  const locationText =
    $("[class*='location'], .address, .property-location")
      .first()
      .text()
      .trim() || title;

  const district = parseDistrict(locationText);
  const city = parseCity(locationText, district);

  // Beds, baths, size
  const detailText = $(
    "[class*='detail'], [class*='feature'], [class*='info'], [class*='spec']"
  ).text();

  const { bedrooms, bathrooms, sizeSqm } = parseBedsBathsSize(
    `${title} ${detailText} ${description ?? ""}`
  );

  // Images
  const imageSet = new Set<string>();

  $("img[src]").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (
      src &&
      src.startsWith("http") &&
      !src.includes("logo") &&
      !src.includes("icon") &&
      !src.includes("avatar") &&
      !src.includes("flag") &&
      !src.includes("badge")
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
    latitude: null,
    longitude: null,
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
    postedAt: null,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */

function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("longtermlettings.com") &&
      /^\/r\/rent\/hms_\d+\/?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function extractListingId(url: string): string | null {
  const m = url.match(/hms_(\d+)/);
  return m ? m[1] : null;
}
