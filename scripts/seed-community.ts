/**
 * Seed script for community feature.
 * Creates sample teacher and student profiles for development.
 *
 * Usage: npx tsx scripts/seed-community.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding community data...");

  // Migrate existing USER role profiles to TEACHER
  const migratedCount = await prisma.user.updateMany({
    where: {
      role: "USER",
      profile: { displayName: { not: null } },
    },
    data: { role: "TEACHER" },
  });
  console.log(`Migrated ${migratedCount.count} existing user profiles to TEACHER role`);

  // Sample teacher users
  const teachers = [
    {
      name: "Sarah Chen",
      email: "sarah.chen.seed@example.com",
      username: "sarah-chen",
      displayName: "Sarah Chen",
      bio: "TEFL-certified teacher heading to Vietnam! Looking for friends and coffee buddies in Ho Chi Minh City.",
      currentCountry: "United Kingdom",
      currentCity: "London",
      relocationStage: "PLANNING" as const,
      teflTesolCertified: true,
      certifications: ["TEFL"],
      languagesTeaching: ["English", "Mandarin"],
      interests: ["Photography", "Street food", "Yoga"],
      targetCountries: ["VIETNAM"],
    },
    {
      name: "Mike Johnson",
      email: "mike.johnson.seed@example.com",
      username: "mike-johnson",
      displayName: "Mike Johnson",
      bio: "Already teaching in Bangkok! Two years in and loving life. Happy to share tips with newcomers.",
      currentCountry: "Thailand",
      currentCity: "Bangkok",
      relocationStage: "TEACHING" as const,
      teflTesolCertified: true,
      certifications: ["CELTA", "TESOL"],
      languagesTeaching: ["English"],
      interests: ["Muay Thai", "Cooking", "Travel"],
      targetCountries: ["THAILAND"],
    },
    {
      name: "Emma Williams",
      email: "emma.williams.seed@example.com",
      username: "emma-williams",
      displayName: "Emma Williams",
      bio: "Just arrived in Phnom Penh! Looking for a study group and city tour buddies. Love exploring temples.",
      currentCountry: "Cambodia",
      currentCity: "Phnom Penh",
      relocationStage: "ARRIVED" as const,
      teflTesolCertified: false,
      certifications: [],
      languagesTeaching: ["English", "French"],
      interests: ["Temples", "History", "Language exchange"],
      targetCountries: ["CAMBODIA", "VIETNAM"],
    },
  ];

  const students = [
    {
      name: "Tuan Nguyen",
      email: "tuan.nguyen.seed@example.com",
      username: "tuan-nguyen",
      displayName: "Tuan Nguyen",
      bio: "Vietnamese student looking for English practice partners. Happy to help with Vietnamese in return!",
      currentCountry: "Vietnam",
      currentCity: "Ho Chi Minh City",
      relocationStage: "PLANNING" as const,
      interests: ["Language exchange", "Coffee", "Gaming"],
      targetCountries: ["VIETNAM"],
      movingTimeline: "Already here",
    },
    {
      name: "Sakura Tanaka",
      email: "sakura.tanaka.seed@example.com",
      username: "sakura-tanaka",
      displayName: "Sakura Tanaka",
      bio: "Japanese student planning to study in Thailand. Interested in cultural exchange and making new friends.",
      currentCountry: "Japan",
      currentCity: "Tokyo",
      relocationStage: "PLANNING" as const,
      interests: ["Cultural exchange", "Cooking", "Art"],
      targetCountries: ["THAILAND"],
      movingTimeline: "3-6 months",
    },
  ];

  for (const t of teachers) {
    const existingUser = await prisma.user.findFirst({
      where: { email: t.email },
    });
    if (existingUser) {
      console.log(`  Skipping ${t.name} (already exists)`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: t.name,
        email: t.email,
        username: t.username,
        role: "TEACHER",
        emailVerified: new Date(),
        lastActiveAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000),
      },
    });

    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: t.displayName,
        bio: t.bio,
        currentCountry: t.currentCountry,
        currentCity: t.currentCity,
        relocationStage: t.relocationStage,
        teflTesolCertified: t.teflTesolCertified,
        certifications: t.certifications,
        languagesTeaching: t.languagesTeaching,
        interests: t.interests,
        visibility: "PUBLIC",
        meetupCoffee: true,
        meetupCityTour: true,
        showCityPublicly: true,
        targetCountries: {
          create: t.targetCountries.map((c) => ({
            country: c as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA",
          })),
        },
      },
    });

    console.log(`  Created teacher: ${t.name} (@${t.username})`);
  }

  for (const s of students) {
    const existingUser = await prisma.user.findFirst({
      where: { email: s.email },
    });
    if (existingUser) {
      console.log(`  Skipping ${s.name} (already exists)`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        username: s.username,
        role: "STUDENT",
        emailVerified: new Date(),
        lastActiveAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000),
      },
    });

    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: s.displayName,
        bio: s.bio,
        currentCountry: s.currentCountry,
        currentCity: s.currentCity,
        relocationStage: s.relocationStage,
        interests: s.interests,
        movingTimeline: s.movingTimeline,
        visibility: "PUBLIC",
        meetupCoffee: true,
        meetupLanguageExchange: true,
        showCityPublicly: true,
        targetCountries: {
          create: s.targetCountries.map((c) => ({
            country: c as "VIETNAM" | "THAILAND" | "CAMBODIA" | "PHILIPPINES" | "INDONESIA" | "MALAYSIA",
          })),
        },
      },
    });

    console.log(`  Created student: ${s.name} (@${s.username})`);
  }

  console.log("Done seeding community data.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
