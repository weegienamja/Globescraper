import { z } from "zod";

// -- Shared constants --

export const ONBOARDING_COUNTRIES = [
  "Vietnam",
  "Thailand",
  "Cambodia",
  "Philippines",
  "Indonesia",
  "Malaysia",
] as const;

export const TEACHING_LANGUAGES = [
  "English",
  "Phonics",
  "IELTS",
  "Business English",
  "Conversational English",
] as const;

export const STUDENT_INTERESTS = [
  "Language exchange",
  "Study group",
  "Coffee meetups",
  "City tours",
  "Job advice",
  "Visa help",
  "Travel buddies",
  "Flatmates",
] as const;

export const TEACHER_LOOKING_FOR = [
  "First job",
  "Better school",
  "Flatmates",
  "Language exchange",
  "Friends",
  "Travel buddies",
] as const;

export const TEACHER_INTERESTS = [
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
  "Travel",
  "Music",
  "Gaming",
  "Yoga",
] as const;

export const MOVING_TIMELINES = [
  { value: "ASAP", label: "As soon as possible" },
  { value: "1_TO_3_MONTHS", label: "1 to 3 months" },
  { value: "3_TO_6_MONTHS", label: "3 to 6 months" },
  { value: "RESEARCHING", label: "Still researching" },
] as const;

// -- Role selection schema --

export const roleSelectionSchema = z.object({
  role: z.enum(["TEACHER", "STUDENT", "RECRUITER"]),
});

// -- Teacher onboarding schema --

export const teacherOnboardingSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(40, "Display name must be under 40 characters"),
  currentCountry: z.string().min(1, "Country is required"),
  currentCity: z.string().max(100).optional().or(z.literal("")),
  targetCountries: z
    .array(z.string())
    .min(1, "Select at least one target country"),
  teflTesol: z.boolean(),
  teachingLanguage: z.string().optional().or(z.literal("")),
  lookingFor: z.array(z.string()).max(6).optional(),
  interests: z.array(z.string()).max(10).optional(),
});

// -- Student onboarding schema --

export const studentOnboardingSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(40, "Display name must be under 40 characters"),
  currentCountry: z.string().min(1, "Country is required"),
  currentCity: z.string().max(100).optional().or(z.literal("")),
  targetCountries: z
    .array(z.string())
    .min(1, "Select at least one target country"),
  interests: z.array(z.string()).max(10).optional(),
  movingTimeline: z.string().optional().or(z.literal("")),
});

// -- Recruiter onboarding schema --

export const recruiterOnboardingSchema = z.object({
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(200, "Company name must be under 200 characters"),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  targetCountries: z
    .array(z.string())
    .min(1, "Select at least one target country"),
  targetCities: z.array(z.string().max(100)).max(10).optional(),
});

export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>;
export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingSchema>;
export type StudentOnboardingInput = z.infer<typeof studentOnboardingSchema>;
export type RecruiterOnboardingInput = z.infer<typeof recruiterOnboardingSchema>;
