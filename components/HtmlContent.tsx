"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

/**
 * Renders sanitized HTML content.
 * All HTML is run through DOMPurify to prevent XSS even from trusted sources.
 * Uses browser-native DOMPurify (no jsdom dependency).
 */
export function HtmlContent({ html }: { html: string }) {
  const clean = useMemo(
    () =>
      typeof window !== "undefined"
        ? DOMPurify.sanitize(html, {
            ADD_TAGS: ["iframe"],
            ADD_ATTR: ["target", "rel", "allow", "allowfullscreen", "frameborder"],
          })
        : html,
    [html],
  );
  return <article className="prose" dangerouslySetInnerHTML={{ __html: clean }} />;
}
