import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MeetupForm } from "./meetup-form";

export const metadata = {
  title: "Create Meetup",
};

export default async function NewMeetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/meetups/new");

  // Require community profile
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true },
  });

  if (!profile?.displayName) {
    return (
      <div className="community-form-page">
        <h1>Create a Meetup</h1>
        <div className="empty-state">
          <div className="empty-state__icon">✏️</div>
          <p className="empty-state__title">Community profile required</p>
          <p className="empty-state__text">
            You need to set up your community profile before creating meetups.
          </p>
          <Link href="/community/edit-profile" className="btn btn--primary btn--sm">
            Set up profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="community-form-page">
      <h1>Create a Meetup</h1>
      <p className="community-form-page__sub">
        Organise a safe, public meetup for teachers. Never share exact addresses.
      </p>
      <MeetupForm />
    </div>
  );
}
