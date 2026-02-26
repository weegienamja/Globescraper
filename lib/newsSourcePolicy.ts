/**
 * News source policy for the Cambodia News Blog Generator.
 *
 * Defines trusted sources by category (official, news, expat, etc.)
 * and provides helpers to classify URLs and enforce source quality.
 */

export type SourceCategory =
  | "OFFICIAL_GOV"
  | "OFFICIAL_TOURISM"
  | "INTERNATIONAL_NEWS"
  | "LOCAL_NEWS"
  | "EXPAT_COMMUNITY"
  | "TRAVEL_INFO"
  | "TEACHING"
  | "GENERAL";

export interface TrustedSource {
  domain: string;
  publisher: string;
  category: SourceCategory;
  /** RSS feed URL if available */
  rssUrl?: string;
}

/**
 * Trusted source registry. Preferred for news discovery.
 * Ordered by reliability within each category.
 */
export const NEWS_SOURCE_REGISTRY: TrustedSource[] = [
  // Official government and institutional sources
  { domain: "evisa.gov.kh", publisher: "Cambodia eVisa", category: "OFFICIAL_GOV" },
  { domain: "mfaic.gov.kh", publisher: "Cambodia Ministry of Foreign Affairs", category: "OFFICIAL_GOV" },
  { domain: "immigration.gov.kh", publisher: "Cambodia Immigration", category: "OFFICIAL_GOV" },
  { domain: "tourismcambodia.com", publisher: "Cambodia Tourism Board", category: "OFFICIAL_TOURISM" },
  { domain: "mot.gov.kh", publisher: "Cambodia Ministry of Tourism", category: "OFFICIAL_TOURISM" },
  { domain: "cambodia-airports.aero", publisher: "Cambodia Airports", category: "OFFICIAL_TOURISM" },

  // International news outlets covering Cambodia
  { domain: "reuters.com", publisher: "Reuters", category: "INTERNATIONAL_NEWS" },
  { domain: "apnews.com", publisher: "Associated Press", category: "INTERNATIONAL_NEWS" },
  { domain: "thediplomat.com", publisher: "The Diplomat", category: "INTERNATIONAL_NEWS", rssUrl: "https://thediplomat.com/feed/" },
  { domain: "aljazeera.com", publisher: "Al Jazeera", category: "INTERNATIONAL_NEWS" },
  { domain: "bbc.com", publisher: "BBC News", category: "INTERNATIONAL_NEWS" },
  { domain: "bbc.co.uk", publisher: "BBC News", category: "INTERNATIONAL_NEWS" },

  // Local Cambodian news outlets
  { domain: "phnompenhpost.com", publisher: "Phnom Penh Post", category: "LOCAL_NEWS", rssUrl: "https://www.phnompenhpost.com/rss" },
  { domain: "khmertimeskh.com", publisher: "Khmer Times", category: "LOCAL_NEWS", rssUrl: "https://www.khmertimeskh.com/feed/" },
  { domain: "cambodianess.com", publisher: "Cambodianess", category: "LOCAL_NEWS", rssUrl: "https://cambodianess.com/feed" },
  { domain: "southeastasiaglobe.com", publisher: "Southeast Asia Globe", category: "LOCAL_NEWS", rssUrl: "https://southeastasiaglobe.com/feed/" },
  { domain: "vodenglish.news", publisher: "VOD English", category: "LOCAL_NEWS" },

  // Expat and community sources
  { domain: "move2cambodia.com", publisher: "Move to Cambodia", category: "EXPAT_COMMUNITY" },
  { domain: "expatinkh.com", publisher: "Expat in KH", category: "EXPAT_COMMUNITY" },

  // Travel info sources
  { domain: "lonelyplanet.com", publisher: "Lonely Planet", category: "TRAVEL_INFO" },
  { domain: "theculturetrip.com", publisher: "Culture Trip", category: "TRAVEL_INFO" },

  // Teaching sources
  { domain: "goabroad.com", publisher: "Go Abroad", category: "TEACHING" },
  { domain: "internationalteflacademy.com", publisher: "International TEFL Academy", category: "TEACHING" },
  { domain: "teflcourse.net", publisher: "TEFL Course", category: "TEACHING" },
];

/**
 * Topics that require at least 1 official source.
 */
export const OFFICIAL_SOURCE_REQUIRED_TOPICS = [
  "visa",
  "immigration",
  "border",
  "e-visa",
  "evisa",
  "law",
  "legal",
  "regulation",
  "health",
  "safety",
  "transport",
  "airport",
  "flight",
  "work permit",
];

/**
 * Check if a URL belongs to a trusted news source.
 * Returns the source info or null.
 */
export function findTrustedSource(url: string): TrustedSource | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return (
      NEWS_SOURCE_REGISTRY.find(
        (s) => hostname === s.domain || hostname.endsWith("." + s.domain)
      ) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Check if a source is an official government or institutional source.
 */
export function isOfficialSource(url: string): boolean {
  const source = findTrustedSource(url);
  return source?.category === "OFFICIAL_GOV" || source?.category === "OFFICIAL_TOURISM";
}

/**
 * Check if a topic requires official sources.
 */
export function topicRequiresOfficialSource(topicTitle: string): boolean {
  const lower = topicTitle.toLowerCase();
  return OFFICIAL_SOURCE_REQUIRED_TOPICS.some((keyword) => lower.includes(keyword));
}

/**
 * Get all sources that have RSS feeds.
 */
export function getSourcesWithRss(): TrustedSource[] {
  return NEWS_SOURCE_REGISTRY.filter((s) => s.rssUrl);
}

/**
 * Get publisher name for a URL, or a fallback based on hostname.
 */
export function getPublisherName(url: string): string {
  const trusted = findTrustedSource(url);
  if (trusted) return trusted.publisher;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Capitalize first letter of domain name
    const name = hostname.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Unknown";
  }
}

/**
 * Domains to never fetch from (content farms, scraped sites, etc.)
 */
const BLOCKED_DOMAINS = [
  "pinterest.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "medium.com",  // too many low quality articles
  "quora.com",
  "blogspot.com",
  "wordpress.com",
  "tumblr.com",
];

/**
 * Check if a domain is explicitly blocked.
 */
export function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d)
    );
  } catch {
    return true;
  }
}
