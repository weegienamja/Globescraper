/**
 * Gemini prompt builders for the email template system.
 */

import { templateCatalogForPrompt, templateCatalog } from "../templates/catalog";

/* ── Types ────────────────────────────────────────────── */

export interface GenerateOptionsInput {
  subject: string;
  previewText?: string;
  objective: string;
  audienceSegment?: string;
  tone?: string;
  length?: string;
  callToAction?: string;
  preferredTemplateId?: string;
  context?: {
    city?: "Phnom Penh" | "Siem Reap" | string;
    campaignType?: "single" | "campaign";
  };
}

/* ── Generate Options Prompt ──────────────────────────── */

export function getGenerateOptionsPrompt(input: GenerateOptionsInput): string {
  const templateSection = input.preferredTemplateId && templateCatalog[input.preferredTemplateId]
    ? `USE THIS TEMPLATE: "${input.preferredTemplateId}". All 3 options must use this template.`
    : "Choose the most appropriate template for each option based on the objective. You may use different templates for different options.";

  return `You are an expert email content strategist for GlobeScraper, a community platform for English teachers and travellers moving to Cambodia.

SYSTEM RULES (MANDATORY, NEVER VIOLATE):
- Output strict JSON only. No markdown fences. No commentary. No text outside the JSON object.
- NEVER use em dashes (the unicode character U+2014 or U+2013, or double hyphens --). Replace with commas, periods, or semicolons.
- NEVER include HTML tags in any field value. No angle brackets. No <p>, <br>, <a>, <strong>, or any other HTML. Only plain text.
- Short sentences. Active voice. Avoid cliches and generic marketing speak.
- Do not invent facts, statistics, or dates. If unsure, phrase as guidance not claims.
- Make content readable on mobile screens. Keep blocks concise.
- Do not use exclamation marks excessively (maximum 1 per option).
- Subject lines must be under 60 characters.
- Preview text must be 40-90 characters.
- Keep headline under 70 characters.
- Keep intro under 450 characters.
- Keep feature/grid bodies under 220 characters each.
- Keep tips under 120 characters each.
- Keep paragraphs under 700 characters each.

ALLOWED TEMPLATES:
welcome_v1, news_alert_v1, weekly_digest_v1, visa_update_v1, new_places_v1

ALLOWED BLOCK TYPES:
hero, paragraphs, cta, featureGrid3, tipsBox, alertBanner, divider, sectionHeading, postList

TEMPLATE RECIPES AND CONSTRAINTS:
${templateCatalogForPrompt()}

BLOCK FIELD SCHEMAS:
- hero: { "headline": string, "intro": string }
- paragraphs: { "paragraphs": [string, ...] }
- cta: { "ctaText": string, "ctaUrl": string, "ctaSubtext"?: string }
- featureGrid3: { "items": [{ "title": string, "body": string }, { "title": string, "body": string }, { "title": string, "body": string }] }
- tipsBox: { "title": string, "tips": [string, string, string] } (3-5 tips)
- alertBanner: { "title": string, "body": string, "severity": "info"|"warning"|"urgent" }
- divider: {} (empty object)
- sectionHeading: { "label": string }
- postList: { "posts": [{ "title": string, "url": string, "desc"?: string }] } (3-5 posts)

IMPORTANT RULES FOR BLOCKS:
- The blocks array must follow the exact block recipe order of the chosen template.
- For divider blocks, fields must be an empty object: {}
- For sectionHeading blocks, use the label from the template constraints or a relevant label.
- For cta blocks, ctaUrl should be "https://globescraper.com" plus an appropriate path.
- For postList blocks, use "https://globescraper.com/blog/" plus a realistic slug for url.

${templateSection}

USER INPUT:
- Subject line (starting point): "${input.subject}"
- Preview text: "${input.previewText || "(propose one)"}"
- Objective: ${input.objective}
- Audience segment: ${input.audienceSegment || "All users"}
- Tone: ${input.tone || "Friendly and professional"}
- Preferred length: ${input.length || "Medium"}
- Call to action: ${input.callToAction || "Visit the platform"}
${input.context?.city ? `- City focus: ${input.context.city}` : ""}
${input.context?.campaignType ? `- Campaign type: ${input.context.campaignType}` : ""}

TASK:
Return exactly 3 different content options. Each option should take a different angle or emphasis while staying relevant to the objective. Make each option distinct and compelling.

OUTPUT JSON SCHEMA (return this exact structure):
{
  "options": [
    {
      "id": "opt_1",
      "templateId": "...",
      "optimizedSubject": "...",
      "optimizedPreviewText": "...",
      "blocks": [
        { "type": "...", "fields": { ... } }
      ],
      "notes": {
        "angle": "Brief description of this option's angle",
        "whoItsFor": "Who this resonates with most",
        "recommendedAudience": "all | teachers | travellers | newcomers"
      }
    },
    { "id": "opt_2", ... },
    { "id": "opt_3", ... }
  ]
}`;
}

/* ── Optimize Subject Prompt ──────────────────────────── */

export function getOptimizeSubjectPrompt(subject: string): string {
  return `You are an email subject line optimizer for GlobeScraper, a community platform for English teachers and travellers moving to Cambodia.

RULES:
- Output strict JSON only. No markdown. No commentary.
- NEVER use em dashes (U+2014, U+2013, or --). Use commas, periods, or semicolons.
- Subject must be under 60 characters.
- Preview text must be 40-90 characters.
- Make it compelling, clear, and mobile-friendly.
- Avoid spam trigger words and excessive punctuation.
- Maximum 1 exclamation mark.
- Do not use generic phrases like "Don't miss out" or "Act now".

Original subject: "${subject}"

Return exactly this JSON:
{
  "optimizedSubject": "...",
  "optimizedPreviewText": "..."
}`;
}
