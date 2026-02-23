
// WARNING: This component renders raw HTML. Only use with trusted, static content.
// If you ever render user input or external content, sanitize it first (e.g. with DOMPurify).
import Link from "next/link";

// Modern reusable header for static HTML pages
function StaticHeader() {
  return (
    <header className="static-header">
      <div className="static-header__container">
        <Link href="/">
          <img
            src="/logo.png"
            alt="GlobeScraper logo"
            className="static-header__logo"
            width={44}
            height={44}
            style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(25,118,210,0.08)" }}
          />
        </Link>
        <nav className="static-header__nav">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/how-it-works-to-teach-english">How it works</Link>
          <Link href="/teach-english-cambodia-no-degree">Starter Guide</Link>
          <Link href="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}

export function HtmlContent({ html }: { html: string }) {
  return (
    <>
      <StaticHeader />
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
