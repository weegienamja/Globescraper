import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TeacherOnboardingForm } from "./TeacherOnboardingForm";

export const metadata = {
  title: "Teacher Onboarding | GlobeScraper",
  robots: { index: false },
};

export default async function TeacherOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  });

  if (!user) redirect("/login");
  if (user.role !== "TEACHER") redirect("/onboarding/who-are-you");

  // If they already have a complete profile, skip
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  });
  if (profile?.displayName) redirect("/community");

  return (
    <div className="onboarding-page">
      <div className="onboarding-page__container onboarding-page__container--form">
        <h1 className="onboarding-page__title">Set up your teacher profile</h1>
        <p className="onboarding-page__subtitle">
          Fill in a few details so other community members can find and connect with you.
        </p>
        <TeacherOnboardingForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
