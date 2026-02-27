/**
 * URL Canonicalization for rental listings.
 *
 * Strips tracking parameters, normalises trailing slashes,
 * and lowercases the hostname for consistent deduplication.
 */

/** Query parameters to strip during canonicalization */
const STRIP_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "gad_source",
  "gad_campaignid",
  "gad_adgroupid",
  "gad_creative",
  "fbclid",
  "ref",
  "source",
]);

/**
 * Canonicalize a URL for deduplication.
 *
 * 1. Parse URL
 * 2. Lowercase hostname
 * 3. Strip tracking query params
 * 4. Remove trailing slash (unless path is "/")
 * 5. Return scheme + host + path (+ remaining query if any)
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hostname = url.hostname.toLowerCase();

    // Strip tracking params
    const params = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (!STRIP_PARAMS.has(key.toLowerCase())) {
        params.set(key, value);
      }
    });

    // Rebuild path without trailing slash
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    const qs = params.toString();
    return `${url.protocol}//${url.hostname}${path}${qs ? `?${qs}` : ""}`;
  } catch {
    // If URL is invalid, return as-is
    return raw;
  }
}
