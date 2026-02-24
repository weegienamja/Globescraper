/**
 * Centralised site configuration.
 * Every component and page should import values from here
 * rather than hard-coding names, URLs, or nav items.
 */
export const siteConfig = {
  name: "GlobeScraper",
  url: "https://globescraper.com",
  description:
    "Teach English in Cambodia. Guides, costs, visas, and support.",
  tagline: "Teach English in Cambodia — guides, support, and community.",
  logoPath: "/logo.svg",
  email: "info@globescraper.com",
  socials: {
    instagram: "https://www.instagram.com/mancavejamie/",
    tiktok: "https://www.tiktok.com/@weegienamja",
  },
  navItems: [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "How it works", href: "/how-it-works-to-teach-english" },
    { label: "Starter Guide", href: "/teach-english-cambodia-no-degree" },
    { label: "About", href: "/about" },
  ],
} as const;

export type NavItem = (typeof siteConfig.navItems)[number];
