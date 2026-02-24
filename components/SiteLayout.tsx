"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { siteConfig } from "@/lib/site";
import { trackNavClick, trackGuideDownload, trackCTAClick } from "@/lib/analytics";

const { navItems, name, logoPath, tagline } = siteConfig;

function Header() {
  const [open, setOpen] = useState(false);

  const handleNavClick = (item: (typeof navItems)[number]) => {
    setOpen(false);
    trackNavClick(item.label, "header");
    if (item.label === "Starter Guide") trackGuideDownload("header_nav");
    if (item.label === "How it works") trackCTAClick("how_it_works_nav");
  };

  const navLinks = navItems.map((item) => (
    <li key={item.href}>
      <Link href={item.href} onClick={() => handleNavClick(item)}>
        {item.label}
      </Link>
    </li>
  ));

  return (
    <header className="header">
      <div className="header__container">
        <Link href="/" className="header__logo-link">
          <Image
            src={logoPath}
            alt={`${name} logo`}
            className="header__logo"
            width={44}
            height={44}
            priority
          />
          <span className="header__wordmark">{name}</span>
        </Link>

        <nav className="header__nav" aria-label="Main navigation">
          <ul className="header__nav-list">{navLinks}</ul>
        </nav>

        <button
          className="header__burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="header__burger-bar" />
          <span className="header__burger-bar" />
          <span className="header__burger-bar" />
        </button>
      </div>

      {open && (
        <nav
          className="header__nav-mobile header__nav-mobile--open"
          aria-label="Mobile navigation"
        >
          <ul className="header__nav-list">{navLinks}</ul>
        </nav>
      )}
    </header>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="container">{children}</main>
      <footer className="footer" onClick={(e) => {
        const anchor = (e.target as HTMLElement).closest("a");
        if (anchor) trackNavClick(anchor.textContent ?? anchor.href, "footer");
      }}>
        <div className="footer__inner">
          <div>
            &copy; {new Date().getFullYear()} {name}
          </div>
          <div className="small">{tagline}</div>
        </div>
      </footer>
    </>
  );
}
