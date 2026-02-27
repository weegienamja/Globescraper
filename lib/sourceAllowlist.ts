/**
 * Allowlist of trusted source domains for the AI Blog Generator.
 * Only pages from these domains will be fetched during research.
 * Each entry includes the domain and a human-readable publisher name.
 */

export interface AllowedSource {
  domain: string;
  publisher: string;
}

export const SOURCE_ALLOWLIST: AllowedSource[] = [
  // Cambodia expat and travel info
  { domain: "phnompenhpost.com", publisher: "Phnom Penh Post" },
  { domain: "khmertimeskh.com", publisher: "Khmer Times" },
  { domain: "cambodianess.com", publisher: "Cambodianess" },
  { domain: "move2cambodia.com", publisher: "Move to Cambodia" },
  { domain: "expatinkh.com", publisher: "Expat in KH" },

  // Teaching and TEFL
  { domain: "goabroad.com", publisher: "Go Abroad" },
  { domain: "internationalteflacademy.com", publisher: "International TEFL Academy" },
  { domain: "teflcourse.net", publisher: "TEFL Course" },

  // Nomad and travel resources
  { domain: "nomadlist.com", publisher: "Nomad List" },
  { domain: "numbeo.com", publisher: "Numbeo" },
  { domain: "expatistan.com", publisher: "Expatistan" },
  { domain: "livingcost.org", publisher: "Living Cost" },

  // General travel and expat
  { domain: "lonelyplanet.com", publisher: "Lonely Planet" },
  { domain: "wikitravel.org", publisher: "Wikitravel" },
  { domain: "tripadvisor.com", publisher: "TripAdvisor" },
  { domain: "theculturetrip.com", publisher: "Culture Trip" },

  // Government and official
  { domain: "evisa.gov.kh", publisher: "Cambodia eVisa" },
  { domain: "mfaic.gov.kh", publisher: "Cambodia Ministry of Foreign Affairs" },

  // Reddit (specific subreddits)
  { domain: "reddit.com", publisher: "Reddit" },
];

/**
 * Check if a URL belongs to an allowed source domain.
 */
export function isAllowedSource(url: string): AllowedSource | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return (
      SOURCE_ALLOWLIST.find(
        (s) => hostname === s.domain || hostname.endsWith("." + s.domain)
      ) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Build Google search query strings for source discovery.
 */
export function buildSearchQueries(
  city: string,
  topic: string,
  audience: string,
  targetKeyword?: string
): string[] {
  const base = `${city} Cambodia ${topic}`;
  const currentYear = new Date().getFullYear();
  const queries = [
    `${base} ${audience} guide ${currentYear}`,
    `${base} expat tips`,
    `${base} cost budget`,
  ];
  if (targetKeyword) {
    queries.push(`${targetKeyword} ${city} Cambodia`);
  }
  return queries;
}
