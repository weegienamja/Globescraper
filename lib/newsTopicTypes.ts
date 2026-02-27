/**
 * Type definitions for the Cambodia News Blog Generator feature.
 */

export type AudienceFit = "TRAVELLERS" | "TEACHERS";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type CityFocus = "Phnom Penh" | "Siem Reap" | "Cambodia wide";
export type AudienceFocus = "travellers" | "teachers" | "both";

/**
 * Feature flag: when true AND real external snippets are available,
 * include sourceUrls / sourceCount / freshnessScore / riskLevel.
 * When false, use the lean schema (searchQueries / intent / outlineAngles).
 */
export const USE_EXTERNAL_SOURCES = false;

export interface NewsTopic {
  id: string;
  title: string;
  angle: string;
  whyItMatters: string;
  audienceFit: AudienceFit[];
  suggestedKeywords: {
    target: string;
    secondary: string[];
  };
  /** True if this topic was generated from a seed title */
  fromSeedTitle?: boolean;

  /* ── Lean schema (always present) ── */
  searchQueries: string[];
  intent: string;
  outlineAngles: string[];

  /* ── External-sources schema (only when USE_EXTERNAL_SOURCES is true) ── */
  sourceUrls?: string[];
  sourceCount?: number;
  freshnessScore?: number;
  riskLevel?: RiskLevel;
}

export interface NewsSearchRequest {
  cityFocus?: CityFocus;
  audienceFocus?: AudienceFocus;
}

export interface NewsSearchResponse {
  topics: NewsTopic[];
}

export interface NewsGenerateRequest {
  topicId: string;
  topicTitle: string;
  angle: string;
  audienceFit: AudienceFit[];
  targetKeyword: string;
  secondaryKeywords: string[];
  seedSourceUrls: string[];
}

export interface NewsGenerateResponse {
  draftId: string;
}

export interface NewsArticleData {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  markdown: string;
  faq: Array<{ q: string; a: string }>;
  internalLinks: Array<{ title: string; slug: string }>;
  sources: Array<{ title: string; url: string; publisher: string }>;
  confidenceLevel: "HIGH" | "LOW";
  contentType: "NEWS";
}

export interface NewsFactsPack {
  topic: string;
  angle: string;
  audienceFit: AudienceFit[];
  targetKeyword: string;
  secondaryKeywords: string[];
  bullets: NewsBullet[];
  sourceCount: number;
  officialSourceCount: number;
}

export interface NewsBullet {
  fact: string;
  sourceUrl: string;
  publisher: string;
  isOfficial: boolean;
}

export interface FetchedSource {
  url: string;
  title: string | null;
  publisher: string;
  text: string;
  fetchedAt: Date;
  isOfficial: boolean;
}
