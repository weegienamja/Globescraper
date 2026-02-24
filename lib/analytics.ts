/**
 * Google Analytics 4 — typed event helpers.
 *
 * All functions are safe to call server-side (they no-op when window is
 * unavailable) and include a dedup guard so React strict-mode double-renders
 * don't fire duplicate events.
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

/** Set of recently-fired event keys used for dedup. */
const _recent = new Set<string>();
const DEDUP_MS = 300;

function dedupKey(name: string, label: string): string {
  return `${name}::${label}`;
}

function safeGtag(
  event: string,
  params: GtagEventParams,
): void {
  if (typeof window === "undefined" || !window.gtag || !GA_ID) return;
  const key = dedupKey(event, params.event_label ?? "");
  if (_recent.has(key)) return;
  _recent.add(key);
  setTimeout(() => _recent.delete(key), DEDUP_MS);
  window.gtag("event", event, params);
}

function currentPath(): string {
  return typeof window !== "undefined" ? window.location.pathname : "";
}

function currentTitle(): string {
  return typeof document !== "undefined" ? document.title : "";
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Send a page_view event (called automatically on route changes). */
export function trackPageView(url: string): void {
  if (typeof window === "undefined" || !window.gtag || !GA_ID) return;
  window.gtag("config", GA_ID, {
    page_path: url,
    page_title: document.title,
  });
}

/** Lead form submission completed. */
export function trackLeadSubmission(location: string): void {
  safeGtag("generate_lead", {
    event_category: "Lead",
    event_label: location,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** CTA button clicked (e.g. "Apply Now", "Get Started"). */
export function trackCTAClick(label: string): void {
  safeGtag("cta_click", {
    event_category: "CTA",
    event_label: label,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** Outbound / external link clicked. */
export function trackOutboundClick(url: string): void {
  safeGtag("outbound_click", {
    event_category: "Outbound",
    event_label: url,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** User scrolled past a percentage threshold. */
export function trackScrollDepth(percent: number): void {
  safeGtag("scroll_depth", {
    event_category: "Engagement",
    event_label: `${percent}%`,
    value: percent,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** Affiliate / partner link clicked (e.g. NordVPN, SafetyWing). */
export function trackAffiliateClick(name: string): void {
  safeGtag("affiliate_click", {
    event_category: "Affiliate",
    event_label: name,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** Guide / resource download (or "Starter Guide" click). */
export function trackGuideDownload(source: string): void {
  safeGtag("guide_download", {
    event_category: "Guide",
    event_label: source,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** Blog card click from the index page. */
export function trackBlogCardClick(slug: string): void {
  safeGtag("blog_card_click", {
    event_category: "Blog",
    event_label: slug,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}

/** Internal nav link click (header or footer). */
export function trackNavClick(label: string, area: "header" | "footer"): void {
  safeGtag("nav_click", {
    event_category: `Navigation_${area}`,
    event_label: label,
    page_path: currentPath(),
    page_title: currentTitle(),
  });
}
