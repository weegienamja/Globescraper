/**
 * Base email layout wrapper.
 * Produces a full HTML document with:
 *   - Outer background table
 *   - Centered card container (max 640px)
 *   - Header with logo/brand
 *   - Hidden preheader text
 *   - Footer with unsubscribe + preferences links
 *   - Minimal responsive <style> block
 */

import { tokens } from "./BaseTokens";
import { esc } from "./ResponsiveHelpers";

export interface BaseLayoutArgs {
  subject: string;
  previewText: string;
  bodyHtml: string;
  links: {
    unsubscribeUrl: string;
    preferencesUrl: string;
    siteUrl: string;
  };
  year: number;
  brand?: {
    name?: string;
    logoUrl?: string;
  };
}

export function renderBaseLayout(args: BaseLayoutArgs): string {
  const {
    subject,
    previewText,
    bodyHtml,
    links,
    year,
    brand = {},
  } = args;

  const brandName = brand.name || "GlobeScraper";
  const logoHtml = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brandName)}" width="36" height="36" style="display:block;border:0;outline:none;" />`
    : `<div style="width:36px;height:36px;border-radius:50%;background:${tokens.accent};color:${tokens.white};font-size:18px;font-weight:700;text-align:center;line-height:36px;">G</div>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body,table,td,p,a,li{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0;mso-table-rspace:0}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
    body{margin:0;padding:0;width:100%!important;-webkit-font-smoothing:antialiased}

    /* Responsive */
    @media only screen and (max-width:620px){
      .outer-table{width:100%!important}
      .inner-pad{padding-left:${tokens.paddingMobile}!important;padding-right:${tokens.paddingMobile}!important}
      .mob-stack{display:block!important;width:100%!important;max-width:100%!important}
      .mob-stack td{padding-left:0!important;padding-right:0!important}
      .mob-h1{font-size:${tokens.h1MobileSize}!important;line-height:1.25!important}
      .mob-hide{display:none!important}
      .mob-center{text-align:center!important}
      .mob-full{width:100%!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${tokens.bg};font-family:${tokens.fontFamily};font-size:${tokens.fontSize};line-height:${tokens.lineHeight};color:${tokens.text};">

  <!-- Preheader (hidden) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${esc(previewText)}${"&zwnj;&nbsp;".repeat(30)}
  </div>

  <!-- Outer background table -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${tokens.bg};">
    <tr>
      <td align="center" style="padding:24px 10px;">

        <!-- Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="outer-table" width="${tokens.containerMaxWidth}" style="max-width:${tokens.containerMaxWidth}px;width:100%;background-color:${tokens.cardBg};border:1px solid ${tokens.border};border-radius:${tokens.radius};overflow:hidden;">

          <!-- Header -->
          <tr>
            <td class="inner-pad" style="padding:${tokens.paddingDesktop};border-bottom:1px solid ${tokens.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;width:44px;">
                    <a href="${esc(links.siteUrl)}" style="text-decoration:none;">
                      ${logoHtml}
                    </a>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;">
                    <a href="${esc(links.siteUrl)}" style="text-decoration:none;color:${tokens.text};font-size:18px;font-weight:700;">
                      ${esc(brandName)}<span style="color:${tokens.mutedText};font-weight:400;">.com</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="inner-pad" style="padding:${tokens.sectionSpacing} ${tokens.paddingDesktop};">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${tokens.footerBg};border-top:1px solid ${tokens.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="inner-pad" style="padding:20px ${tokens.paddingDesktop};text-align:center;font-size:13px;color:${tokens.mutedText};line-height:1.5;">
                    <p style="margin:0 0 8px;">You're receiving this email because you subscribed to ${esc(brandName)}.com</p>
                    <p style="margin:0;">
                      <a href="${esc(links.unsubscribeUrl)}" style="color:${tokens.accent};text-decoration:underline;">Unsubscribe</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${esc(links.preferencesUrl)}" style="color:${tokens.accent};text-decoration:underline;">Manage preferences</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Copyright -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${tokens.containerMaxWidth}" style="max-width:${tokens.containerMaxWidth}px;width:100%;">
          <tr>
            <td style="padding:16px 0;text-align:center;font-size:12px;color:${tokens.mutedText};">
              &copy; ${year} ${esc(brandName)}
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
