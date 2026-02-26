/**
 * FeatureGrid3 block: 3 columns that stack on mobile.
 */

import { tokens } from "../base/BaseTokens";
import { esc, stackableColumns } from "../base/ResponsiveHelpers";

export interface FeatureGrid3Fields {
  items: [
    { title: string; body: string },
    { title: string; body: string },
    { title: string; body: string },
  ];
}

function featureCard(item: { title: string; body: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${tokens.footerBg};border:1px solid ${tokens.border};border-radius:${tokens.radiusSmall};overflow:hidden;">
  <tr>
    <td style="padding:16px;">
      <p style="margin:0 0 6px;font-family:${tokens.fontFamily};font-size:15px;font-weight:700;color:${tokens.text};">${esc(item.title)}</p>
      <p style="margin:0;font-family:${tokens.fontFamily};font-size:14px;line-height:1.5;color:${tokens.mutedText};">${esc(item.body)}</p>
    </td>
  </tr>
</table>`;
}

export function renderFeatureGrid3(fields: FeatureGrid3Fields): string {
  const cols = fields.items.map((item) => ({
    html: featureCard(item),
    width: "33.33%",
  }));

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td style="padding-bottom:${tokens.blockSpacing};">
    ${stackableColumns(cols, 12)}
  </td></tr>
</table>`;
}

export function featureGrid3Text(fields: FeatureGrid3Fields): string {
  return fields.items
    .map((item, i) => `${i + 1}. ${item.title}\n   ${item.body}`)
    .join("\n\n");
}
