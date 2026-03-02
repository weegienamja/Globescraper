import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CommunityProfileForm } from "./community-profile-form";
import { isRecruiter, needsOnboarding } from "@/lib/rbac";
import type { AppRole } from "@/types/next-auth";

const ENUM_COUNTRY_MAP: Record<string, string> = {
  VIETNAM: "Vietnam",
  THAILAND: "Thailand",
  CAMBODIA: "Cambodia",
  PHILIPPINES: "Philippines",
  INDONESIA: "Indonesia",
  MALAYSIA: "Malaysia",
};

export const metadata = {
  title: "Edit Community Profile",
};

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === "string");
    } catch {
      return [];
    }
  }
  return [];
}

export default async function EditCommunityProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/community/edit-profile");

  const userRole = (session.user.role ?? "USER") as AppRole;
  // Recruiters manage their own dashboard; redirect them
  if (isRecruiter(userRole)) redirect("/community/recruiter-dashboard");
  // Users who haven't picked a role yet must onboard first
  if (needsOnboarding(userRole)) redirect("/onboarding/who-are-you");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      targetCountries: { select: { country: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, caption: true } },
    },
  });

  const initial = profile
    ? {
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        currentCountry: profile.currentCountry ?? "",
        currentCity: profile.currentCity ?? "",
        targetCountries: profile.targetCountries.map(
          (tc) => ENUM_COUNTRY_MAP[tc.country] ?? tc.country,
        ),
        visibility: profile.visibility,
        meetupCoffee: profile.meetupCoffee,
        meetupCityTour: profile.meetupCityTour,
        meetupJobAdvice: profile.meetupJobAdvice,
        meetupStudyGroup: profile.meetupStudyGroup,
        meetupLanguageExchange: profile.meetupLanguageExchange,
        meetupVisaHelp: profile.meetupVisaHelp,
        meetupSchoolReferrals: profile.meetupSchoolReferrals,
        meetupExploring: profile.meetupExploring,
        avatarUrl: profile.avatarUrl ?? null,
        galleryImages: profile.images.map((img) => ({ id: img.id, url: img.url, caption: img.caption ?? "" })),
        relocationStage: profile.relocationStage ?? "PLANNING",
        lookingFor: profile.lookingFor ?? null,
        certifications: safeJsonArray(profile.certifications),
        languagesTeaching: safeJsonArray(profile.languagesTeaching),
        interests: safeJsonArray(profile.interests),
        showCityPublicly: profile.showCityPublicly,
        teflTesolCertified: profile.teflTesolCertified ?? false,
        movingTimeline: (profile.movingTimeline as string) ?? "",
      }
    : null;

  return (
    <div className="community-form-page">
      <h1>{profile?.displayName ? "Edit Community Profile" : "Set Up Your Community Profile"}</h1>
      <p className="community-form-page__sub">
        This is how you appear to other community members. Your email is never shared.
      </p>
      <CommunityProfileForm initial={initial} userId={session.user.id} role={userRole} />
    </div>
  );
}
