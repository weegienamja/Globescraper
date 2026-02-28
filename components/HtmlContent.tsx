"use client";

import { useMemo, useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";
import { labelTableCells } from "@/lib/tableMobile";

/**
 * Renders sanitized HTML content.
 * Uses isomorphic-dompurify so HTML is sanitized on both server (SSR) and client.
 */
export function HtmlContent({ html }: { html: string }) {
  const ref = useRef<HTMLElement>(null);
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: ["target", "rel", "allow", "allowfullscreen", "frameborder"],
      }),
    [html],
  );

  useEffect(() => {
    if (ref.current) labelTableCells(ref.current);
  }, [clean]);

  return <article className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: clean }} />;
}
