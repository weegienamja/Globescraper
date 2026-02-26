/**
 * Responsive email helpers.
 * Utility functions for building table-based, email-client-safe layouts.
 */

import { tokens } from "./BaseTokens";

/** Escape text for safe HTML rendering */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build inline style string from an object */
export function inlineStyle(styles: Record<string, string | number>): string {
  return Object.entries(styles)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${prop}:${v}`;
    })
    .join(";");
}

/** Create a vertical spacer row */
export function spacer(height: number = 24): string {
  return `<tr><td style="height:${height}px;line-height:${height}px;font-size:1px;">&nbsp;</td></tr>`;
}

/**
 * Create a stackable multi-column row.
 * Columns are rendered as a single-row table that stacks on mobile
 * via the .mob-stack class. Falls back gracefully in Outlook.
 */
export function stackableColumns(
  columns: { html: string; width?: string }[],
  gap: number = 16,
): string {
  const colCount = columns.length;
  const colWidth = columns[0]?.width || `${Math.floor(100 / colCount)}%`;

  let cells = "";
  columns.forEach((col, i) => {
    cells += `<!--[if mso]><td valign="top" width="${Math.floor(tokens.containerMaxWidth / colCount)}" style="width:${colWidth}"><![endif]-->
<div class="mob-stack" style="display:inline-block;vertical-align:top;width:${colWidth};max-width:${colWidth};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:0 ${i < colCount - 1 ? gap / 2 : 0}px 0 ${i > 0 ? gap / 2 : 0}px;vertical-align:top;">
      ${col.html}
    </td></tr>
  </table>
</div>
<!--[if mso]></td><![endif]-->`;
  });

  return `<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><![endif]-->
${cells}
<!--[if mso]></tr></table><![endif]-->`;
}

/** Wrap content in a padded table cell */
export function paddedCell(
  html: string,
  padding: string = tokens.paddingDesktop,
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td style="padding:0 ${padding};">${html}</td></tr>
</table>`;
}
