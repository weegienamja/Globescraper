/**
 * Centralised affiliate link registry.
 * Import from here whenever you need an affiliate URL in code or scripts.
 */

export const AFFILIATE_LINKS = {
  safetywing: {
    name: "SafetyWing",
    url: "https://safetywing.com/?referenceID=26254350&utm_source=26254350&utm_medium=Ambassador",
    description: "Travel medical insurance for digital nomads and teachers abroad",
  },
  nordvpn: {
    name: "NordVPN",
    url: "https://nordvpn.com/?utm_medium=affiliate&utm_term&utm_content&utm_source=aff&utm_campaign=off",
    description: "VPN for secure browsing, banking, and geo-restricted content",
  },
  italki: {
    name: "italki",
    url: "https://www.italki.com/affshare?ref=af11774499",
    description: "Online language learning platform — find tutors for any language",
  },
} as const;

export type AffiliateKey = keyof typeof AFFILIATE_LINKS;
