"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  trackPageView,
  trackOutboundClick,
  trackAffiliateClick,
  trackScrollDepth,
} from "@/lib/analytics";

/* ------------------------------------------------------------------ */
/*  Affiliate domain patterns                                          */
/* ------------------------------------------------------------------ */
const AFFILIATE_PATTERNS: [RegExp, string][] = [
  [/bridge\.edu/i, "Bridge TEFL"],
  [/nordvpn/i, "NordVPN"],
  [/safetywing/i, "SafetyWing"],
  [/anker/i, "Anker"],
  [/tefl|tesol/i, "TEFL Course"],
];

function affiliateName(url: string): string | null {
  for (const [re, name] of AFFILIATE_PATTERNS) {
    if (re.test(url)) return name;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Drop-in client component that handles:
 *   1. Pageview on every route change (usePathname)
 *   2. Outbound + affiliate link clicks (delegated listener on <body>)
 *   3. Scroll-depth milestones (25 / 50 / 75 / 100 %)
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  /* ---- Pageview on route change ---- */
  useEffect(() => {
    // Skip the initial render (GA config script already fires a pageview)
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    trackPageView(pathname);
  }, [pathname]);

  /* ---- Outbound & affiliate click delegation ---- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.href;
      if (!href || href.startsWith("javascript")) return;

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) {
          const aff = affiliateName(href);
          if (aff) {
            trackAffiliateClick(aff);
          } else {
            trackOutboundClick(href);
          }
        }
      } catch {
        // malformed URL — ignore
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  /* ---- Scroll depth milestones ---- */
  useEffect(() => {
    const fired = new Set<number>();
    const thresholds = [25, 50, 75, 100];

    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          trackScrollDepth(t);
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]); // reset thresholds on route change

  return null; // no UI
}
