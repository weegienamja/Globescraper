/**
 * CTA block: centered button with optional sub-text.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface CTAFields {
  ctaText: string;
  ctaUrl: string;
  ctaSubtext?: string;
}

export function renderCTA(fields: CTAFields): string {
  const subtextHtml = fields.ctaSubtext
    ? `<p style="margin:12px 0 0;font-size:13px;color:${tokens.mutedText};">${esc(fields.ctaSubtext)}</p>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td align="center" style="padding:${tokens.blockSpacing} 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="background-color:${tokens.accent};border-radius:${tokens.buttonRadius};">
            <a href="${esc(fields.ctaUrl)}" target="_blank" style="display:inline-block;padding:${tokens.buttonPadding};font-family:${tokens.fontFamily};font-size:${tokens.buttonFontSize};font-weight:700;color:${tokens.white};text-decoration:none;border-radius:${tokens.buttonRadius};background-color:${tokens.accent};mso-padding-alt:0;">
              <!--[if mso]><i style="mso-font-width:200%;mso-text-raise:12pt">&nbsp;</i><![endif]-->
              <span style="mso-text-raise:6pt;">${esc(fields.ctaText)}</span>
              <!--[if mso]><i style="mso-font-width:200%">&nbsp;</i><![endif]-->
            </a>
          </td>
        </tr>
      </table>
      ${subtextHtml}
      <!-- Accessible fallback link -->
      <p style="margin:8px 0 0;font-size:12px;color:${tokens.mutedText};">
        <a href="${esc(fields.ctaUrl)}" style="color:${tokens.accent};text-decoration:underline;">${esc(fields.ctaUrl)}</a>
      </p>
    </td>
  </tr>
</table>`;
}

export function ctaText(fields: CTAFields): string {
  let text = `${fields.ctaText}: ${fields.ctaUrl}`;
  if (fields.ctaSubtext) text += `\n${fields.ctaSubtext}`;
  return text;
}
