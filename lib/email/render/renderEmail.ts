/**
 * Render email HTML from validated blocks + base layout.
 */

import { blockRegistry, isValidBlockType, type Block } from "../blocks/index";
import { renderBaseLayout, type BaseLayoutArgs } from "../base/BaseLayout";
import { tokens } from "../base/BaseTokens";

export interface RenderEmailInput {
  blocks: Block[];
  subject: string;
  previewText: string;
  links: {
    unsubscribeUrl: string;
    preferencesUrl: string;
    siteUrl: string;
  };
  year: number;
  brand?: { name?: string; logoUrl?: string };
}

/**
 * Render blocks into body HTML, then wrap in the base layout.
 */
export function renderEmail(input: RenderEmailInput): string {
  const bodyParts: string[] = [];

  for (const block of input.blocks) {
    if (!isValidBlockType(block.type)) {
      // Skip unknown blocks gracefully
      continue;
    }
    const handler = blockRegistry[block.type];
    const html = handler.renderHtml(block.fields);
    // Wrap each block in a spacing container
    bodyParts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td style="padding-bottom:${tokens.blockSpacing};">${html}</td></tr>
</table>`,
    );
  }

  const bodyHtml = bodyParts.join("\n");

  const layoutArgs: BaseLayoutArgs = {
    subject: input.subject,
    previewText: input.previewText,
    bodyHtml,
    links: input.links,
    year: input.year,
    brand: input.brand,
  };

  return renderBaseLayout(layoutArgs);
}
