"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { labelTableCells } from "@/lib/tableMobile";

/**
 * Renders markdown content using react-markdown with GFM support.
 * Uses the existing .prose class for consistent blog styling.
 */
export function MarkdownContent({ markdown }: { markdown: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) labelTableCells(ref.current);
  }, [markdown]);

  return (
    <article className="prose" ref={ref}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
