import { z } from "zod";

// ── Enum values (must match Prisma schema) ───────────────────

export const TARGET_COUNTRIES = [
  "VIETNAM",
  "THAILAND",
  "CAMBODIA",
  "INDONESIA",
  "PHILIPPINES",
  "MALAYSIA",
] as const;

export const DEGREE_STATUSES = [
  "NONE",
  "IN_PROGRESS",
  "BACHELORS",
  "MASTERS",
] as const;

export const TEACHING_EXPERIENCES = [
  "NONE",
  "LT1_YEAR",
  "ONE_TO_THREE",
  "THREE_PLUS",
] as const;

export const CERTIFICATION_STATUSES = [
  "NONE",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export const DESIRED_START_TIMELINES = [
  "ASAP",
  "ONE_TO_THREE_MONTHS",
  "THREE_TO_SIX_MONTHS",
  "RESEARCHING",
] as const;

export const SAVINGS_BANDS = ["LOW", "MEDIUM", "HIGH"] as const;

// ── Human-readable labels ────────────────────────────────────

export const COUNTRY_LABELS: Record<(typeof TARGET_COUNTRIES)[number], string> = {
  VIETNAM: "Vietnam",
  THAILAND: "Thailand",
  CAMBODIA: "Cambodia",
  INDONESIA: "Indonesia",
  PHILIPPINES: "Philippines",
  MALAYSIA: "Malaysia",
};

export const DEGREE_LABELS: Record<(typeof DEGREE_STATUSES)[number], string> = {
  NONE: "No degree",
  IN_PROGRESS: "In progress",
  BACHELORS: "Bachelor's",
  MASTERS: "Master's",
};

export const EXPERIENCE_LABELS: Record<(typeof TEACHING_EXPERIENCES)[number], string> = {
  NONE: "None",
  LT1_YEAR: "Less than 1 year",
  ONE_TO_THREE: "1–3 years",
  THREE_PLUS: "3+ years",
};

export const CERTIFICATION_LABELS: Record<(typeof CERTIFICATION_STATUSES)[number], string> = {
  NONE: "None",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const TIMELINE_LABELS: Record<(typeof DESIRED_START_TIMELINES)[number], string> = {
  ASAP: "ASAP",
  ONE_TO_THREE_MONTHS: "1–3 months",
  THREE_TO_SIX_MONTHS: "3–6 months",
  RESEARCHING: "Just researching",
};

export const SAVINGS_LABELS: Record<(typeof SAVINGS_BANDS)[number], string> = {
  LOW: "Under $2,000",
  MEDIUM: "$2,000–$5,000",
  HIGH: "$5,000+",
};

// ── Zod schemas ──────────────────────────────────────────────

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const profileSchema = z.object({
  passportCountry: z.string().min(1, "Passport country is required").max(100),
  degreeStatus: z.enum(DEGREE_STATUSES),
  nativeEnglish: z.boolean(),
  teachingExperience: z.enum(TEACHING_EXPERIENCES),
  certificationStatus: z.enum(CERTIFICATION_STATUSES),
  targetCountries: z
    .array(z.enum(TARGET_COUNTRIES))
    .min(1, "Select at least one target country"),
  desiredStartTimeline: z.enum(DESIRED_START_TIMELINES),
  savingsBand: z.enum(SAVINGS_BANDS),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
