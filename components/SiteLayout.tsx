
import Link from "next/link";
import { useState } from "react";

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="header__container">
        <Link href="/" className="header__logo-link">
          <img src="/logo.svg" alt="GlobeScraper logo" className="header__logo" width={44} height={44} />
          <span className="header__wordmark">GlobeScraper</span>
        </Link>
        <nav className="header__nav" aria-label="Main navigation">
          <ul className="header__nav-list">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/how-it-works-to-teach-english">How it works</Link></li>
            <li><Link href="/teach-english-cambodia-no-degree">Starter Guide</Link></li>
            <li><Link href="/about">About</Link></li>
          </ul>
        </nav>
        <button className="header__burger" aria-label="Menu" onClick={() => setOpen(!open)}>
          <span className="header__burger-bar" />
          <span className="header__burger-bar" />
          <span className="header__burger-bar" />
        </button>
      </div>
      <nav className={`header__nav-mobile${open ? " header__nav-mobile--open" : ""}`} aria-label="Mobile navigation">
        <ul className="header__nav-list">
          <li><Link href="/" onClick={() => setOpen(false)}>Home</Link></li>
          <li><Link href="/blog" onClick={() => setOpen(false)}>Blog</Link></li>
          <li><Link href="/how-it-works-to-teach-english" onClick={() => setOpen(false)}>How it works</Link></li>
          <li><Link href="/teach-english-cambodia-no-degree" onClick={() => setOpen(false)}>Starter Guide</Link></li>
          <li><Link href="/about" onClick={() => setOpen(false)}>About</Link></li>
        </ul>
      </nav>
    </header>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="container">{children}</main>
      <footer className="container footer">
        <div>© {new Date().getFullYear()} GlobeScraper</div>
        <div className="small">Built as a custom Node.js app on Hostinger.</div>
      </footer>
    </>
  );
}
