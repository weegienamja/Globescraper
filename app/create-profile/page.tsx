import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateProfileForm } from "./create-profile-form";

export default async function CreateProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
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
