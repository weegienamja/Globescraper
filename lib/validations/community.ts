import { z } from "zod";

// ── Constants ────────────────────────────────────────────────

export const COMMUNITY_COUNTRIES = [
  "Vietnam",
  "Thailand",
  "Cambodia",
  "Philippines",
] as const;

export const INTENT_LABELS: Record<string, string> = {
  meetupCoffee: "☕ Coffee",
  meetupCityTour: "🏙️ City tour",
  meetupJobAdvice: "💼 Job advice",
  meetupStudyGroup: "📚 Study group",
  meetupLanguageExchange: "🗣️ Language exchange",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Public — anyone can view",
  MEMBERS_ONLY: "Members only — logged-in users",
  PRIVATE: "Private — only you and admins",
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  SCAM: "Scam",
  OTHER: "Other",
};

// ── Zod schemas ──────────────────────────────────────────────

export const communityProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50),
  bio: z.string().max(500).optional().or(z.literal("")),
  currentCountry: z.string().max(100).optional().or(z.literal("")),
  currentCity: z.string().max(100).optional().or(z.literal("")),
  targetCountries: z
    .array(z.string())
    .min(1, "Select at least one target country"),
  visibility: z.enum(["PRIVATE", "MEMBERS_ONLY", "PUBLIC"]),
  meetupCoffee: z.boolean(),
  meetupCityTour: z.boolean(),
  meetupJobAdvice: z.boolean(),
  meetupStudyGroup: z.boolean(),
  meetupLanguageExchange: z.boolean(),
});

export const connectionRequestSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().max(300).optional().or(z.literal("")),
});

export const meetupSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  dateTime: z.string().refine(
    (d) => new Date(d) > new Date(),
    "Date must be in the future",
  ),
  locationHint: z.string().max(200).optional().or(z.literal("")),
  maxAttendees: z.coerce.number().int().min(2).max(100).nullable().optional(),
  visibility: z.enum(["MEMBERS_ONLY", "PUBLIC"]),
});

export const reportSchema = z.object({
  targetType: z.enum(["USER", "MEETUP"]),
  targetId: z.string().min(1),
  reason: z.enum(["SPAM", "HARASSMENT", "SCAM", "OTHER"]),
  details: z.string().max(1000).optional().or(z.literal("")),
});

export type CommunityProfileInput = z.infer<typeof communityProfileSchema>;
export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;
export type MeetupInput = z.infer<typeof meetupSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
