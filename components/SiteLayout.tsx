"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { siteConfig } from "@/lib/site";
import { trackNavClick, trackGuideDownload, trackCTAClick } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RevealOnScroll } from "@/components/RevealOnScroll";

const { navItems, name, logoPath, tagline, socials } = siteConfig;

function AuthButtons() {
  const { data: session, status } = useSession();

  // Don't render anything while loading to avoid flash
  if (status === "loading") return null;

  if (session?.user) {
    return (
      <div className="header__auth">
        <Link href="/dashboard" className="header__auth-link">
          Dashboard
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="header__auth-btn header__auth-btn--outline"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="header__auth">
      <Link href="/login" className="header__auth-link">
        Sign in
      </Link>
      <Link href="/signup" className="header__auth-btn">
        Sign up
      </Link>
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Body scroll lock
  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => { document.body.classList.remove("menu-open"); };
  }, [open]);

  // Focus mobile nav when open
  useEffect(() => {
    if (open && menuRef.current) menuRef.current.focus();
  }, [open]);

  // Inert attribute for accessibility (prevents tab into hidden panel)
  useEffect(() => {
    if (menuRef.current) {
      if (open) {
        menuRef.current.removeAttribute("inert");
      } else {
        menuRef.current.setAttribute("inert", "");
      }
    }
  }, [open]);

  // Navbar scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <>
      <header className={`header${scrolled ? " header--scrolled" : ""}`}>
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

          <AuthButtons />

          <ThemeToggle />

          <button
            className={`header__burger${open ? " header__burger--open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            <span className="header__burger-bar" />
            <span className="header__burger-bar" />
            <span className="header__burger-bar" />
          </button>
        </div>
      </header>

      {/* Semi-transparent overlay behind mobile menu */}
      <div
        className={`mobile-overlay${open ? " mobile-overlay--visible" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-in mobile nav panel */}
      <nav
        id="mobile-nav"
        ref={menuRef}
        className={`header__nav-mobile${open ? " header__nav-mobile--open" : ""}`}
        aria-label="Mobile navigation"
        tabIndex={-1}
      >
        <ul className="header__nav-list">{navLinks}</ul>
        <div className="header__auth-mobile">
          <AuthButtons />
        </div>
      </nav>
    </>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-nav">Skip to content</a>
      <Header />
      <main id="main-content" className="container">{children}</main>
      <footer className="footer" onClick={(e) => {
        const anchor = (e.target as HTMLElement).closest("a");
        if (anchor) trackNavClick(anchor.textContent ?? anchor.href, "footer");
      }}>
        <div className="footer__inner">
          <div>
            &copy; {new Date().getFullYear()} {name}
          </div>
          <div className="small">{tagline}</div>
          <nav className="footer__nav" aria-label="Footer navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
            <a href={socials.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href={socials.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>
          </nav>
        </div>
      </footer>
      <RevealOnScroll />
    </>
  );
}
