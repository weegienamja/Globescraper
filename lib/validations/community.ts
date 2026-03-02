import { z } from "zod";

// ── Constants ────────────────────────────────────────────────

export const COMMUNITY_COUNTRIES = [
  "Vietnam",
  "Thailand",
  "Cambodia",
  "Philippines",
] as const;

export const INTENT_LABELS: Record<string, string> = {
  meetupCoffee: "☕ Coffee meetups",
  meetupCityTour: "🏙️ City tour",
  meetupJobAdvice: "💼 Job advice",
  meetupStudyGroup: "📚 Study group",
  meetupLanguageExchange: "🗣️ Language exchange",
  meetupVisaHelp: "🛂 Visa help chat",
  meetupSchoolReferrals: "🏫 School referrals",
  meetupExploring: "🏛️ Exploring temples",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Public (anyone can view)",
  MEMBERS_ONLY: "Members only (logged-in users)",
  PRIVATE: "Private (only you and admins)",
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  SCAM: "Scam",
  OTHER: "Other",
};

export const RELOCATION_STAGES = [
  { value: "PLANNING", label: "Planning" },
  { value: "SECURED_JOB", label: "Secured Job" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "TEACHING", label: "Teaching" },
  { value: "RENEWING_VISA", label: "Renewing Visa" },
] as const;

export const LOOKING_FOR_OPTIONS = [
  { value: "FIRST_JOB", label: "First job" },
  { value: "BETTER_SCHOOL", label: "Better school" },
  { value: "FLATMATES", label: "Flatmates" },
  { value: "LANGUAGE_EXCHANGE", label: "Language exchange" },
  { value: "FRIENDS", label: "Friends" },
  { value: "TRAVEL_BUDDIES", label: "Travel buddies" },
] as const;

export const REPLY_TIME_OPTIONS = [
  { value: "WITHIN_HOUR", label: "Replies within an hour" },
  { value: "WITHIN_FEW_HOURS", label: "Typically replies within a few hours" },
  { value: "WITHIN_DAY", label: "Replies within a day" },
  { value: "NOT_ACTIVE", label: "Not very active" },
] as const;

export const CERTIFICATION_OPTIONS = [
  "TEFL/TESOL",
  "CELTA",
  "PGCE",
  "DELTA",
  "Trinity CertTESOL",
] as const;

export const SUGGESTED_INTERESTS = [
  "Motorbikes",
  "Coffee shops",
  "History",
  "Hiking",
  "Gym",
  "Muay Thai",
  "Photography",
  "Food",
  "Nightlife",
  "Tech",
  "Property rental",
  "Travel",
  "Music",
  "Gaming",
  "Yoga",
] as const;

// ── Zod schemas ──────────────────────────────────────────────

export const communityProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(40, "Display name must be under 40 characters"),
  bio: z
    .string()
    .min(10, "Bio must be at least 10 characters")
    .max(240, "Bio must be under 240 characters"),
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
  meetupVisaHelp: z.boolean(),
  meetupSchoolReferrals: z.boolean(),
  meetupExploring: z.boolean(),
  // New fields
  relocationStage: z.enum([
    "PLANNING",
    "SECURED_JOB",
    "ARRIVED",
    "TEACHING",
    "RENEWING_VISA",
  ]),
  lookingFor: z
    .enum([
      "FIRST_JOB",
      "BETTER_SCHOOL",
      "FLATMATES",
      "LANGUAGE_EXCHANGE",
      "FRIENDS",
      "TRAVEL_BUDDIES",
    ])
    .nullable()
    .optional(),
  certifications: z.array(z.string().max(100)).max(10).optional(),
  languagesTeaching: z.array(z.string().max(100)).max(10).optional(),
  interests: z.array(z.string().max(100)).max(20).optional(),
  showCityPublicly: z.boolean().optional(),
  // Role-specific fields
  teflTesolCertified: z.boolean().optional(),
  movingTimeline: z.string().max(100).nullable().optional(),
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
  targetType: z.enum(["USER", "MEETUP", "MESSAGE"]),
  targetId: z.string().min(1),
  reason: z.enum(["SPAM", "HARASSMENT", "SCAM", "OTHER"]),
  details: z.string().max(1000).optional().or(z.literal("")),
});

export const messageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  body: z.string().min(1, "Message cannot be empty").max(2000),
});

export type CommunityProfileInput = z.infer<typeof communityProfileSchema>;
export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;
export type MeetupInput = z.infer<typeof meetupSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
