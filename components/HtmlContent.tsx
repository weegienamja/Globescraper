
// WARNING: This component renders raw HTML. Only use with trusted, static content.
// If you ever render user input or external content, sanitize it first (e.g. with DOMPurify).
export function HtmlContent({ html }: { html: string }) {
  return (
    <article
      className="prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
