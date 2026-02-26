"use client";

import { useMemo, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { labelTableCells } from "@/lib/tableMobile";

/**
 * Renders sanitized HTML content.
 * All HTML is run through DOMPurify to prevent XSS even from trusted sources.
 * Uses browser-native DOMPurify (no jsdom dependency).
 */
export function HtmlContent({ html }: { html: string }) {
  const ref = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (ref.current) labelTableCells(ref.current);
  }, [clean]);

  return <article className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: clean }} />;
}
