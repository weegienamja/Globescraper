/**
 * AlertBanner block: colored banner for notices.
 */

import { tokens } from "../base/BaseTokens";
import { esc } from "../base/ResponsiveHelpers";

export interface AlertBannerFields {
  title: string;
  body: string;
  severity: "info" | "warning" | "urgent";
}

const severityMap = {
  info: { bg: tokens.infoBg, border: tokens.infoBorder, text: tokens.infoText, icon: "ℹ️" },
  warning: { bg: tokens.warningBg, border: tokens.warningBorder, text: tokens.warningText, icon: "⚠️" },
  urgent: { bg: tokens.urgentBg, border: tokens.urgentBorder, text: tokens.urgentText, icon: "🚨" },
};

export function renderAlertBanner(fields: AlertBannerFields): string {
  const s = severityMap[fields.severity] || severityMap.info;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:2px solid ${s.border};border-radius:${tokens.radiusSmall};background-color:${s.bg};overflow:hidden;">
  <tr>
    <td style="padding:20px;">
      <p style="margin:0 0 8px;font-family:${tokens.fontFamily};font-size:17px;font-weight:700;color:${s.text};">
        ${s.icon}&nbsp; ${esc(fields.title)}
      </p>
      <p style="margin:0;font-family:${tokens.fontFamily};font-size:15px;line-height:1.55;color:${s.text};">
        ${esc(fields.body)}
      </p>
    </td>
  </tr>
</table>`;
}

export function alertBannerText(fields: AlertBannerFields): string {
  const prefix = fields.severity === "urgent" ? "[URGENT] " : fields.severity === "warning" ? "[WARNING] " : "[INFO] ";
  return `${prefix}${fields.title}\n${fields.body}`;
}
