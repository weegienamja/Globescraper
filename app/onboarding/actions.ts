"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  roleSelectionSchema,
  teacherOnboardingSchema,
  studentOnboardingSchema,
  recruiterOnboardingSchema,
} from "@/lib/validations/onboarding";

type ActionResult = { ok: true } | { error: string };

function generateUsername(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${base}-${suffix}`;
}

// -- Set role (who-are-you step) --

export async function setUserRole(data: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = roleSelectionSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Prevent changing role if already set beyond USER
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user) return { error: "User not found" };
  if (user.role !== "USER") {
    return { error: "Role has already been set. Contact support to change it." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: parsed.data.role },
  });

  return { ok: true };
}

// -- Complete teacher onboarding --

export async function completeTeacherOnboarding(
  data: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = teacherOnboardingSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, username: true },
  });
  if (!user) return { error: "User not found" };
  if (user.role !== "TEACHER") return { error: "Invalid role for this form" };

  const {
    displayName,
    currentCountry,
    currentCity,
    targetCountries,
    teflTesol,
    teachingLanguage,
    lookingFor,
    interests,
  } = parsed.data;

  const countryMap: Record<string, string> = {
    Vietnam: "VIETNAM",
    Thailand: "THAILAND",
    Cambodia: "CAMBODIA",
    Philippines: "PHILIPPINES",
    Indonesia: "INDONESIA",
    Malaysia: "MALAYSIA",
  };
  const enumCountries = targetCountries
    .map((c) => countryMap[c])
    .filter(Boolean);

  // Generate username if not set
  let username = user.username;
  if (!username) {
    username = generateUsername(displayName);
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!existing) break;
      username = generateUsername(displayName);
      attempts++;
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { username },
    });
  }

  // Upsert profile
  await prisma.profile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      displayName,
      currentCountry: currentCountry || null,
      currentCity: currentCity || null,
      teflTesolCertified: teflTesol,
      certifications: teflTesol ? ["TEFL/TESOL"] : [],
      languagesTeaching: teachingLanguage ? [teachingLanguage] : [],
      interests: interests ?? [],
      visibility: "PUBLIC",
      targetCountries: {
        create: enumCountries.map((country) => ({
          country: country as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA",
        })),
      },
    },
    update: {
      displayName,
      currentCountry: currentCountry || null,
      currentCity: currentCity || null,
      teflTesolCertified: teflTesol,
      certifications: teflTesol ? ["TEFL/TESOL"] : [],
      languagesTeaching: teachingLanguage ? [teachingLanguage] : [],
      interests: interests ?? [],
      targetCountries: {
        deleteMany: {},
        create: enumCountries.map((country) => ({
          country: country as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA",
        })),
      },
    },
  });

  return { ok: true };
}

// -- Complete student onboarding --

export async function completeStudentOnboarding(
  data: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = studentOnboardingSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, username: true },
  });
  if (!user) return { error: "User not found" };
  if (user.role !== "STUDENT") return { error: "Invalid role for this form" };

  const {
    displayName,
    currentCountry,
    currentCity,
    targetCountries,
    interests,
    movingTimeline,
  } = parsed.data;

  const countryMap: Record<string, string> = {
    Vietnam: "VIETNAM",
    Thailand: "THAILAND",
    Cambodia: "CAMBODIA",
    Philippines: "PHILIPPINES",
    Indonesia: "INDONESIA",
    Malaysia: "MALAYSIA",
  };
  const enumCountries = targetCountries
    .map((c) => countryMap[c])
    .filter(Boolean);

  // Generate username if not set
  let username = user.username;
  if (!username) {
    username = generateUsername(displayName);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!existing) break;
      username = generateUsername(displayName);
      attempts++;
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { username },
    });
  }

  await prisma.profile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      displayName,
      currentCountry: currentCountry || null,
      currentCity: currentCity || null,
      interests: interests ?? [],
      movingTimeline: movingTimeline || null,
      visibility: "PUBLIC",
      targetCountries: {
        create: enumCountries.map((country) => ({
          country: country as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA",
        })),
      },
    },
    update: {
      displayName,
      currentCountry: currentCountry || null,
      currentCity: currentCity || null,
      interests: interests ?? [],
      movingTimeline: movingTimeline || null,
      targetCountries: {
        deleteMany: {},
        create: enumCountries.map((country) => ({
          country: country as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA",
        })),
      },
    },
  });

  return { ok: true };
}

// -- Complete recruiter onboarding --

export async function completeRecruiterOnboarding(
  data: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = recruiterOnboardingSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user) return { error: "User not found" };
  if (user.role !== "RECRUITER") return { error: "Invalid role for this form" };

  const { companyName, website, targetCountries, targetCities } = parsed.data;

  await prisma.recruiterProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      companyName: companyName || null,
      website: website || null,
      targetCountries: targetCountries,
      targetCities: targetCities ?? [],
    },
    update: {
      companyName: companyName || null,
      website: website || null,
      targetCountries: targetCountries,
      targetCities: targetCities ?? [],
    },
  });

  return { ok: true };
}
