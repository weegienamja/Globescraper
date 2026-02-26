/**
 * Zod schemas for AI-generated email template options.
 * Validates block fields and the overall AI response shape.
 */

import { z } from "zod";

/* ── Block field schemas ──────────────────────────────── */

export const heroSchema = z.object({
  headline: z.string().min(1).max(70),
  intro: z.string().min(1).max(450),
});

export const paragraphsSchema = z.object({
  paragraphs: z.array(z.string().min(1).max(700)).min(1).max(6),
});

export const ctaSchema = z.object({
  ctaText: z.string().min(1).max(60),
  ctaUrl: z.string().url(),
  ctaSubtext: z.string().max(120).optional(),
});

export const featureGrid3Schema = z.object({
  items: z.tuple([
    z.object({ title: z.string().min(1).max(60), body: z.string().min(1).max(220) }),
    z.object({ title: z.string().min(1).max(60), body: z.string().min(1).max(220) }),
    z.object({ title: z.string().min(1).max(60), body: z.string().min(1).max(220) }),
  ]),
});

export const tipsBoxSchema = z.object({
  title: z.string().min(1).max(80),
  tips: z.array(z.string().min(1).max(120)).min(3).max(5),
});

export const alertBannerSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(400),
  severity: z.enum(["info", "warning", "urgent"]),
});

export const dividerSchema = z.object({}).optional();

export const sectionHeadingSchema = z.object({
  label: z.string().min(1).max(60),
});

export const postListSchema = z.object({
  posts: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        url: z.string().url(),
        desc: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(8),
});

/* ── Block schema map ─────────────────────────────────── */

export const blockFieldSchemas: Record<string, z.ZodTypeAny> = {
  hero: heroSchema,
  paragraphs: paragraphsSchema,
  cta: ctaSchema,
  featureGrid3: featureGrid3Schema,
  tipsBox: tipsBoxSchema,
  alertBanner: alertBannerSchema,
  divider: z.object({}).or(z.undefined()),
  sectionHeading: sectionHeadingSchema,
  postList: postListSchema,
};

/* ── Single block schema ──────────────────────────────── */

export const blockSchema = z.object({
  type: z.enum([
    "hero",
    "paragraphs",
    "cta",
    "featureGrid3",
    "tipsBox",
    "alertBanner",
    "divider",
    "sectionHeading",
    "postList",
  ]),
  fields: z.record(z.unknown()),
});

/* ── Option schema ────────────────────────────────────── */

export const optionSchema = z.object({
  id: z.string(),
  templateId: z.enum([
    "welcome_v1",
    "news_alert_v1",
    "weekly_digest_v1",
    "visa_update_v1",
    "new_places_v1",
  ]),
  optimizedSubject: z.string().min(1).max(80),
  optimizedPreviewText: z.string().min(1).max(120),
  blocks: z.array(blockSchema).min(1).max(20),
  notes: z.object({
    angle: z.string().min(1),
    whoItsFor: z.string().min(1),
    recommendedAudience: z.string().min(1),
  }),
});

/* ── Full AI response schema ──────────────────────────── */

export const generateOptionsResponseSchema = z.object({
  options: z.array(optionSchema).length(3),
});

/* ── Optimize subject response ────────────────────────── */

export const optimizeSubjectResponseSchema = z.object({
  optimizedSubject: z.string().min(1).max(80),
  optimizedPreviewText: z.string().min(1).max(120),
});

/* ── Render request schema ────────────────────────────── */

export const renderRequestSchema = z.object({
  selectedOption: optionSchema,
  links: z.object({
    unsubscribeUrl: z.string().url(),
    preferencesUrl: z.string().url(),
    siteUrl: z.string().url(),
  }),
  year: z.number().int().min(2024).max(2100),
});

/* ── Inferred types ───────────────────────────────────── */

export type TemplateOption = z.infer<typeof optionSchema>;
export type GenerateOptionsResponse = z.infer<typeof generateOptionsResponseSchema>;
export type RenderRequest = z.infer<typeof renderRequestSchema>;
