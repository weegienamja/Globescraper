/**
 * Hero block: big headline + intro paragraph.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface HeroFields {
  headline: string;
  intro: string;
}

export function renderHero(fields: HeroFields): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding-bottom:${tokens.blockSpacing};text-align:center;">
      <h1 class="mob-h1" style="margin:0 0 14px;font-family:${tokens.fontFamily};font-size:${tokens.h1Size};font-weight:700;line-height:1.25;color:${tokens.text};">
        ${esc(fields.headline)}
      </h1>
      <p style="margin:0;font-size:${tokens.fontSize};line-height:${tokens.lineHeight};color:${tokens.mutedText};">
        ${esc(fields.intro)}
      </p>
    </td>
  </tr>
</table>`;
}

export function heroText(fields: HeroFields): string {
  return `${fields.headline}\n\n${fields.intro}`;
}
