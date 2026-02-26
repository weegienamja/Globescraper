"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { siteConfig } from "@/lib/site";
import { trackNavClick, trackCTAClick } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { ActivityTracker } from "@/components/ActivityTracker";

const { navItems, name, logoPath, tagline, socials } = siteConfig;

/* ── Avatar dropdown (logged-in users) ──────────────────── */

function AvatarDropdown({ pendingCount }: { pendingCount: number }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (status === "loading") return <div className="avatar-placeholder" />;

  if (!session?.user) {
    return (
      <div className="header__auth-buttons">
        <Link href="/login" className="header__auth-link">Sign in</Link>
        <Link href="/signup" className="header__auth-btn">Sign up</Link>
      </div>
    );
  }

  const avatarUrl = session.user.avatarUrl;
  const initial = (session.user.name?.[0] ?? session.user.email?.[0] ?? "?").toUpperCase();
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="avatar-dropdown" ref={ref}>
      <button
        className="avatar-dropdown__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Profile photo"
            width={36}
            height={36}
            className="avatar-dropdown__img"
          />
        ) : (
          <span className="avatar-dropdown__initial">{initial}</span>
        )}
        {pendingCount > 0 && (
          <span className="avatar-badge" aria-label={`${pendingCount} pending connection requests`}>
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="avatar-dropdown__menu" role="menu">
          <div className="avatar-dropdown__header">
            <span className="avatar-dropdown__name">{session.user.name ?? "Member"}</span>
            <span className="avatar-dropdown__email">{session.user.email}</span>
          </div>
          <div className="avatar-dropdown__divider" />
          <Link href="/dashboard" className="avatar-dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </Link>
          <Link href="/community/edit-profile" className="avatar-dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Edit Profile
          </Link>
          <Link href={`/community/${session.user.id}`} className="avatar-dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Public Profile
          </Link>
          <Link href="/dashboard/requests" className="avatar-dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Connections
            {pendingCount > 0 && (
              <span className="menu-badge">{pendingCount > 9 ? "9+" : pendingCount}</span>
            )}
          </Link>
          <Link href="/dashboard/messages" className="avatar-dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Messages
          </Link>
          {isAdmin && (
            <Link href="/admin" className="avatar-dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4"/></svg>
              Admin Panel
            </Link>
          )}
          <div className="avatar-dropdown__divider" />
          <button
            className="avatar-dropdown__item avatar-dropdown__item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────── */

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const menuRef = useRef<HTMLElement>(null);
  const { data: session } = useSession();

  // Fetch pending connection request count
  const fetchPendingCount = useCallback(() => {
    if (!session?.user) return;
    fetch("/api/connections/pending-count")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.count ?? 0))
      .catch(() => {});
  }, [session?.user]);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

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

  // Inert attribute for accessibility
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
          {/* Left zone: logo + theme toggle */}
          <div className="header__left">
            <Link href="/" className="header__logo-link">
              <Image
                src={logoPath}
                alt={`${name} logo`}
                className="header__logo"
                width={64}
                height={64}
                priority
              />
              <span className="header__wordmark">{name}</span>
            </Link>
            <ThemeToggle />
          </div>

          {/* Center: desktop nav */}
          <nav className="header__nav" aria-label="Main navigation">
            <ul className="header__nav-list">{navLinks}</ul>
          </nav>

          {/* Right zone: avatar dropdown (desktop) + burger (mobile) */}
          <div className="header__right">
            <div className="header__right-desktop">
              <AvatarDropdown pendingCount={pendingCount} />
            </div>
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
        {/* Mobile user info */}
        {session?.user && (
          <div className="mobile-nav__user">
            {session.user.avatarUrl ? (
              <Image
                src={session.user.avatarUrl}
                alt="Profile photo"
                width={48}
                height={48}
                className="avatar-dropdown__img"
              />
            ) : (
              <span className="avatar-dropdown__initial avatar-dropdown__initial--mobile">
                {(session.user.name?.[0] ?? "?").toUpperCase()}
              </span>
            )}
            <div>
              <div className="mobile-nav__name">{session.user.name ?? "Member"}</div>
              <div className="mobile-nav__email">{session.user.email}</div>
            </div>
          </div>
        )}

        <ul className="header__nav-list">{navLinks}</ul>

        {/* Mobile: auth actions */}
        <div className="header__auth-mobile">
          {session?.user ? (
            <>
              <div className="mobile-nav__section-label">Account</div>
              <div className="mobile-nav__actions">
                <Link href="/dashboard" className="mobile-nav__action-link" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  Dashboard
                </Link>
                <Link href="/community/edit-profile" className="mobile-nav__action-link" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Edit Profile
                </Link>
                <Link href="/dashboard/requests" className="mobile-nav__action-link" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Connections
                  {pendingCount > 0 && (
                    <span className="menu-badge">{pendingCount > 9 ? "9+" : pendingCount}</span>
                  )}
                </Link>
                <Link href="/dashboard/messages" className="mobile-nav__action-link" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Messages
                </Link>
                {session.user.role === "ADMIN" && (
                  <Link href="/admin" className="mobile-nav__action-link" onClick={() => setOpen(false)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4"/></svg>
                    Admin Panel
                  </Link>
                )}
                <button
                  className="mobile-nav__action-link mobile-nav__action-link--danger"
                  onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="mobile-nav__auth-buttons">
              <Link href="/login" className="header__auth-link" onClick={() => setOpen(false)}>Sign in</Link>
              <Link href="/signup" className="header__auth-btn" onClick={() => setOpen(false)}>Sign up</Link>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-wrapper">
      <a href="#main-content" className="skip-nav">Skip to content</a>
      <ActivityTracker />
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
    </div>
  );
}
