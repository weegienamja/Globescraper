"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders markdown content using react-markdown with GFM support.
 * Uses the existing .prose class for consistent blog styling.
 */
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <article className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
