/**
 * Template catalog: each template defines a recipe of allowed blocks.
 * The AI must choose a template and produce blocks in this exact order.
 */

import type { BlockType } from "../blocks/index";

export interface TemplateDef {
  id: string;
  name: string;
  purpose: string;
  blockRecipe: BlockType[];
  designIntent: string;
  constraints: string[];
}

export const templateCatalog: Record<string, TemplateDef> = {
  welcome_v1: {
    id: "welcome_v1",
    name: "Welcome",
    purpose: "Welcome new users and drive the first action.",
    blockRecipe: [
      "hero",
      "paragraphs",
      "cta",
      "divider",
      "sectionHeading",
      "featureGrid3",
      "divider",
      "sectionHeading",
      "tipsBox",
    ],
    designIntent:
      "Friendly welcome tone. Hero headline that feels personal. CTA is first and clear. " +
      "3 feature cards describe: Guides, Community, Meetups. " +
      "Tips box includes 3 quick actions (profile, read guide, join group).",
    constraints: [
      "Friendly and professional tone",
      'CTA should be "Complete your profile" or "Join the community"',
      "Tips are practical next steps",
      "Paragraphs: 1-2",
    ],
  },

  news_alert_v1: {
    id: "news_alert_v1",
    name: "Breaking News Alert",
    purpose: "Up to date Cambodia travel and teaching changes.",
    blockRecipe: [
      "alertBanner",
      "hero",
      "paragraphs",
      "tipsBox",
      "cta",
    ],
    designIntent:
      "Start with AlertBanner. Then a calm headline. " +
      "Paragraphs explain what changed and who it affects. " +
      "Tips box gives immediate actions. CTA links to the full guide or update page.",
    constraints: [
      'Must include "What changed" and "What you should do" framing',
      "Avoid sensationalism",
      "No invented facts",
      "Paragraphs: 2-4",
      "AlertBanner severity: warning or urgent",
      "TipsBox: 3-5 action steps",
    ],
  },

  weekly_digest_v1: {
    id: "weekly_digest_v1",
    name: "Weekly Digest",
    purpose: "Recap top updates and drive clicks.",
    blockRecipe: [
      "hero",
      "paragraphs",
      "sectionHeading",
      "postList",
      "divider",
      "sectionHeading",
      "tipsBox",
      "cta",
    ],
    designIntent:
      "Skimmable. PostList shows 3-5 items with short descriptions. " +
      "Tips box gives quick wins. CTA encourages reading the most important guide.",
    constraints: [
      "Short, skim friendly",
      "Post list must have clear reasons to click",
      "Paragraphs: 1",
      "PostList: 3-5 items",
    ],
  },

  visa_update_v1: {
    id: "visa_update_v1",
    name: "Visa and Requirements Update",
    purpose: "Visa rule changes, requirements, fees, enforcement updates.",
    blockRecipe: [
      "alertBanner",
      "hero",
      "paragraphs",
      "sectionHeading",
      "tipsBox",
      "cta",
    ],
    designIntent:
      "Clear checklist. Avoid hype. Use tips box as checklist items.",
    constraints: [
      "Clear checklist actions",
      "Encourage reading the full guide on site",
      "Paragraphs: 2-4",
      "AlertBanner severity: info or warning",
      "Use checklist phrasing in tips",
    ],
  },

  new_places_v1: {
    id: "new_places_v1",
    name: "New Places Spotlight",
    purpose: "Highlight new bars, cafes, coworking, neighborhoods, openings.",
    blockRecipe: [
      "hero",
      "paragraphs",
      "featureGrid3",
      "tipsBox",
      "cta",
    ],
    designIntent:
      "Fun, local. FeatureGrid3 highlights 3 places, each with why it matters and a budget hint. " +
      "Tips box includes practical visit advice.",
    constraints: [
      "Fun but not cringe",
      "Avoid cliches",
      "Be specific about who it is for (teachers, travellers, nomads)",
      "Paragraphs: 1-2",
      "FeatureGrid3: 3 places with budget hints",
    ],
  },
};

export const templateIds = Object.keys(templateCatalog);

export function getTemplate(id: string): TemplateDef | undefined {
  return templateCatalog[id];
}

/**
 * Returns a formatted string representation of all templates
 * for embedding in AI prompts.
 */
export function templateCatalogForPrompt(): string {
  return Object.values(templateCatalog)
    .map((t) => {
      const blocks = t.blockRecipe.join(", ");
      const constraints = t.constraints.map((c) => `  - ${c}`).join("\n");
      return `Template "${t.id}" (${t.name})
Purpose: ${t.purpose}
Block recipe (in order): ${blocks}
Design intent: ${t.designIntent}
Constraints:
${constraints}`;
    })
    .join("\n\n");
}
