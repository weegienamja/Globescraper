/**
 * Paragraphs block: array of paragraph strings.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface ParagraphsFields {
  paragraphs: string[];
}

export function renderParagraphs(fields: ParagraphsFields): string {
  const paras = fields.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${tokens.fontFamily};font-size:${tokens.fontSize};line-height:${tokens.lineHeight};color:${tokens.text};">${esc(p)}</p>`,
    )
    .join("\n");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td style="padding-bottom:8px;">${paras}</td></tr>
</table>`;
}

export function paragraphsText(fields: ParagraphsFields): string {
  return fields.paragraphs.join("\n\n");
}
