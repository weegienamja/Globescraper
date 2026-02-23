import DOMPurify from "isomorphic-dompurify";

/**
 * Renders sanitized HTML content.
 * All HTML is run through DOMPurify to prevent XSS even from trusted sources.
 */
export function HtmlContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "rel", "allow", "allowfullscreen", "frameborder"],
  });
  return <article className="prose" dangerouslySetInnerHTML={{ __html: clean }} />;
}
