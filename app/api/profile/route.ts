import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { profileSchema } from "@/lib/validations/profile";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const {
      passportCountry,
      degreeStatus,
      nativeEnglish,
      teachingExperience,
      certificationStatus,
      targetCountries,
      desiredStartTimeline,
      savingsBand,
    } = parsed.data;

    // Upsert so users can re-complete their profile
    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        passportCountry,
        degreeStatus,
        nativeEnglish,
        teachingExperience,
        certificationStatus,
        desiredStartTimeline,
        savingsBand,
        targetCountries: {
          create: targetCountries.map((country) => ({ country })),
        },
      },
      update: {
        passportCountry,
        degreeStatus,
        nativeEnglish,
        teachingExperience,
        certificationStatus,
        desiredStartTimeline,
        savingsBand,
        targetCountries: {
          // Delete existing, then recreate
          deleteMany: {},
          create: targetCountries.map((country) => ({ country })),
        },
      },
    });

    return NextResponse.json({ ok: true, profileId: profile.id }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      include: { targetCountries: true },
    });

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
