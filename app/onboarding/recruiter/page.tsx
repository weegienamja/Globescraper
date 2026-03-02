import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecruiterOnboardingForm } from "./RecruiterOnboardingForm";

export const metadata = {
  title: "Recruiter Onboarding | GlobeScraper",
  robots: { index: false },
};

export default async function RecruiterOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user) redirect("/login");
  if (user.role !== "RECRUITER") redirect("/onboarding/who-are-you");

  const existing = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (existing) redirect("/community/recruiter-dashboard");

  return (
    <div className="onboarding-page">
      <div className="onboarding-page__container onboarding-page__container--form">
        <h1 className="onboarding-page__title">Set up your recruiter profile</h1>
        <p className="onboarding-page__subtitle">
          Tell us about your company so we can help you find the right candidates.
        </p>
        <RecruiterOnboardingForm />
      </div>
    </div>
  );
}
