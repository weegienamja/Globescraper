import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StudentOnboardingForm } from "./StudentOnboardingForm";

export const metadata = {
  title: "Student Onboarding | GlobeScraper",
  robots: { index: false },
};

export default async function StudentOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true },
  });

  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/onboarding/who-are-you");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  });
  if (profile?.displayName) redirect("/community");

  return (
    <div className="onboarding-page">
      <div className="onboarding-page__container onboarding-page__container--form">
        <h1 className="onboarding-page__title">Set up your student profile</h1>
        <p className="onboarding-page__subtitle">
          Tell us what you are looking for so the community can help.
        </p>
        <StudentOnboardingForm defaultName={user.name ?? ""} />
      </div>
    </div>
  );
}
