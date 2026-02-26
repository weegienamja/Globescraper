/**
 * Divider block: simple horizontal line.
 */

import { tokens } from "../base/BaseTokens";

export function renderDivider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:${tokens.blockSpacing} 0;">
      <div style="border-top:1px solid ${tokens.border};font-size:1px;line-height:1px;">&nbsp;</div>
    </td>
  </tr>
</table>`;
}

export function dividerText(): string {
  return "\n---\n";
}
