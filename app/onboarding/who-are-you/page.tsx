import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoleSelector } from "./RoleSelector";

export const metadata = {
  title: "Who are you? | GlobeScraper",
  robots: { index: false },
};

export default async function WhoAreYouPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user) redirect("/login");

  // If role is already set beyond USER, redirect them
  if (user.role === "TEACHER") redirect("/community");
  if (user.role === "STUDENT") redirect("/community");
  if (user.role === "RECRUITER") redirect("/community/recruiter-dashboard");
  if (user.role === "ADMIN") redirect("/admin");

  return (
    <div className="onboarding-page">
      <div className="onboarding-page__container">
        <h1 className="onboarding-page__title">Who are you?</h1>
        <p className="onboarding-page__subtitle">
          Tell us a bit about yourself so we can personalize your experience.
          You can always update your details later.
        </p>

        <RoleSelector />
      </div>
    </div>
  );
}
