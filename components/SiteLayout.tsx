import Link from "next/link";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="container">
        <nav className="nav">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/">GlobeScraper</Link>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/blog">Blog</Link>
            <Link href="/how-it-works-to-teach-english">How it works</Link>
            <Link href="/teach-english-cambodia-no-degree">Starter Guide</Link>
            <Link href="/about">About</Link>
          </div>
        </nav>
      </header>

      <main className="container">{children}</main>

      <footer className="container footer">
        <div>© {new Date().getFullYear()} GlobeScraper</div>
        <div className="small">Built as a custom Node.js app on Hostinger.</div>
      </footer>
    </>
  );
}
