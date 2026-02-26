/**
 * Centralized brand tokens for email templates.
 * All values are email-client-safe (no CSS custom properties).
 */

export const tokens = {
  /* ── Colors ─────────────────────────────────────────── */
  bg: "#f4f6f8",
  cardBg: "#ffffff",
  border: "#e2e8f0",
  text: "#1e293b",
  mutedText: "#64748b",
  accent: "#2563eb",
  accentDark: "#1d4ed8",
  accentSoft: "#eff6ff",
  accentSoftBorder: "#bfdbfe",
  white: "#ffffff",
  footerBg: "#f8fafc",
  warningBg: "#fffbeb",
  warningBorder: "#fbbf24",
  warningText: "#92400e",
  urgentBg: "#fef2f2",
  urgentBorder: "#f87171",
  urgentText: "#991b1b",
  infoBg: "#eff6ff",
  infoBorder: "#60a5fa",
  infoText: "#1e40af",

  /* ── Typography ─────────────────────────────────────── */
  fontFamily: "Arial, Helvetica, sans-serif",
  monoFamily: "'Courier New', Courier, monospace",
  fontSize: "16px",
  lineHeight: "1.6",
  h1Size: "26px",
  h1MobileSize: "22px",
  h2Size: "20px",
  labelSize: "12px",

  /* ── Spacing ────────────────────────────────────────── */
  containerMaxWidth: 640,
  paddingDesktop: "26px",
  paddingMobile: "18px",
  blockSpacing: "24px",
  sectionSpacing: "32px",

  /* ── Radius ─────────────────────────────────────────── */
  radius: "14px",
  radiusSmall: "8px",

  /* ── Button ─────────────────────────────────────────── */
  buttonPadding: "14px 32px",
  buttonRadius: "8px",
  buttonFontSize: "16px",
} as const;

export type Tokens = typeof tokens;
