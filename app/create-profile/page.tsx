import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateProfileForm } from "./create-profile-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Profile",
  description: "Set up your GlobeScraper profile and join the Southeast Asia teaching community.",
  robots: { index: false, follow: false },
};

export default async function CreateProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Admins don't need to complete a profile
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  // If user already has a profile, redirect to dashboard
  const existing = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (existing) {
    redirect("/dashboard");
  }

  return <CreateProfileForm />;
}
