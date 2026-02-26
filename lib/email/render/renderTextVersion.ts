/**
 * Render plain text version of an email from blocks.
 */

import { blockRegistry, isValidBlockType, type Block } from "../blocks/index";

export interface RenderTextInput {
  blocks: Block[];
  subject: string;
  previewText: string;
  links: {
    unsubscribeUrl: string;
    preferencesUrl: string;
    siteUrl: string;
  };
  brand?: { name?: string };
  year: number;
}

export function renderTextVersion(input: RenderTextInput): string {
  const brandName = input.brand?.name || "GlobeScraper";
  const parts: string[] = [];

  for (const block of input.blocks) {
    if (!isValidBlockType(block.type)) continue;
    const handler = blockRegistry[block.type];
    const text = handler.renderText(block.fields);
    if (text.trim()) parts.push(text);
  }

  const body = parts.join("\n\n");

  const footer = [
    "---",
    `You're receiving this email because you subscribed to ${brandName}.com`,
    `Unsubscribe: ${input.links.unsubscribeUrl}`,
    `Manage preferences: ${input.links.preferencesUrl}`,
    `(c) ${input.year} ${brandName}`,
  ].join("\n");

  return `${body}\n\n${footer}\n`;
}
