/**
 * Block registry: maps block type strings to render + text functions.
 */

import { renderHero, heroText, type HeroFields } from "./Hero";
import { renderParagraphs, paragraphsText, type ParagraphsFields } from "./Paragraphs";
import { renderCTA, ctaText, type CTAFields } from "./CTA";
import { renderFeatureGrid3, featureGrid3Text, type FeatureGrid3Fields } from "./FeatureGrid3";
import { renderTipsBox, tipsBoxText, type TipsBoxFields } from "./TipsBox";
import { renderAlertBanner, alertBannerText, type AlertBannerFields } from "./AlertBanner";
import { renderDivider, dividerText } from "./Divider";
import { renderSectionHeading, sectionHeadingText, type SectionHeadingFields } from "./SectionHeading";
import { renderPostList, postListText, type PostListFields } from "./PostList";

/* ── Block type union ─────────────────────────────────── */

export type BlockType =
  | "hero"
  | "paragraphs"
  | "cta"
  | "featureGrid3"
  | "tipsBox"
  | "alertBanner"
  | "divider"
  | "sectionHeading"
  | "postList";

export interface Block {
  type: BlockType;
  fields: Record<string, unknown>;
}

/* ── Registry ─────────────────────────────────────────── */

interface BlockHandler {
  renderHtml: (fields: Record<string, unknown>) => string;
  renderText: (fields: Record<string, unknown>) => string;
}

export const blockRegistry: Record<BlockType, BlockHandler> = {
  hero: {
    renderHtml: (f) => renderHero(f as unknown as HeroFields),
    renderText: (f) => heroText(f as unknown as HeroFields),
  },
  paragraphs: {
    renderHtml: (f) => renderParagraphs(f as unknown as ParagraphsFields),
    renderText: (f) => paragraphsText(f as unknown as ParagraphsFields),
  },
  cta: {
    renderHtml: (f) => renderCTA(f as unknown as CTAFields),
    renderText: (f) => ctaText(f as unknown as CTAFields),
  },
  featureGrid3: {
    renderHtml: (f) => renderFeatureGrid3(f as unknown as FeatureGrid3Fields),
    renderText: (f) => featureGrid3Text(f as unknown as FeatureGrid3Fields),
  },
  tipsBox: {
    renderHtml: (f) => renderTipsBox(f as unknown as TipsBoxFields),
    renderText: (f) => tipsBoxText(f as unknown as TipsBoxFields),
  },
  alertBanner: {
    renderHtml: (f) => renderAlertBanner(f as unknown as AlertBannerFields),
    renderText: (f) => alertBannerText(f as unknown as AlertBannerFields),
  },
  divider: {
    renderHtml: () => renderDivider(),
    renderText: () => dividerText(),
  },
  sectionHeading: {
    renderHtml: (f) => renderSectionHeading(f as unknown as SectionHeadingFields),
    renderText: (f) => sectionHeadingText(f as unknown as SectionHeadingFields),
  },
  postList: {
    renderHtml: (f) => renderPostList(f as unknown as PostListFields),
    renderText: (f) => postListText(f as unknown as PostListFields),
  },
};

export function isValidBlockType(type: string): type is BlockType {
  return type in blockRegistry;
}

/* Re-export field types for convenience */
export type {
  HeroFields,
  ParagraphsFields,
  CTAFields,
  FeatureGrid3Fields,
  TipsBoxFields,
  AlertBannerFields,
  SectionHeadingFields,
  PostListFields,
};
