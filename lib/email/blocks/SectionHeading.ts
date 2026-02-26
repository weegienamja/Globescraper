/**
 * SectionHeading block: uppercase label for new sections.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface SectionHeadingFields {
  label: string;
}

export function renderSectionHeading(fields: SectionHeadingFields): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:4px 0 12px;">
      <p style="margin:0;font-family:${tokens.fontFamily};font-size:${tokens.labelSize};font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${tokens.mutedText};">
        ${esc(fields.label)}
      </p>
    </td>
  </tr>
</table>`;
}

export function sectionHeadingText(fields: SectionHeadingFields): string {
  return `\n== ${fields.label.toUpperCase()} ==\n`;
}
