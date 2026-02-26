/**
 * TipsBox block: bordered box with a title and bullet points.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface TipsBoxFields {
  title: string;
  tips: string[];
}

export function renderTipsBox(fields: TipsBoxFields): string {
  const tipItems = fields.tips
    .map(
      (tip) =>
        `<tr>
      <td style="padding:0 0 8px 0;vertical-align:top;width:24px;font-size:14px;color:${tokens.accent};">&#8226;</td>
      <td style="padding:0 0 8px 4px;font-family:${tokens.fontFamily};font-size:14px;line-height:1.5;color:${tokens.text};">${esc(tip)}</td>
    </tr>`,
    )
    .join("\n");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${tokens.border};border-radius:${tokens.radiusSmall};overflow:hidden;">
  <tr>
    <td style="padding:20px;">
      <p style="margin:0 0 14px;font-family:${tokens.fontFamily};font-size:16px;font-weight:700;color:${tokens.text};">${esc(fields.title)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${tipItems}
      </table>
    </td>
  </tr>
</table>`;
}

export function tipsBoxText(fields: TipsBoxFields): string {
  const tips = fields.tips.map((t) => `  - ${t}`).join("\n");
  return `${fields.title}\n${tips}`;
}
