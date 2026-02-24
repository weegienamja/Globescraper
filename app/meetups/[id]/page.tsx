import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { RsvpButton, CancelMeetupButton, MeetupReportButton } from "./meetup-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { title: true, city: true, country: true },
  });
  if (!meetup) return { title: "Meetup not found" };
  return {
    title: meetup.title,
    description: `Community meetup in ${meetup.city}, ${meetup.country}.`,
  };
}

export default async function MeetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserId = session?.user?.id;

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          profile: { select: { displayName: true } },
        },
      },
      attendees: {
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!meetup) notFound();

  // Visibility check
  if (meetup.visibility === "MEMBERS_ONLY" && !currentUserId) {
    redirect("/login?callbackUrl=/meetups/" + id);
  }

  const isCreator = currentUserId === meetup.createdByUserId;
  const isAdmin = session?.user?.role === "ADMIN";
  const isCancelled = meetup.status === "CANCELLED";
  const isPast = new Date(meetup.dateTime) < new Date();

  // Current user's RSVP status
  const myAttendance = currentUserId
    ? meetup.attendees.find((a) => a.userId === currentUserId)
    : null;

  const goingCount = meetup.attendees.filter((a) => a.status === "GOING").length;
  const interestedCount = meetup.attendees.filter((a) => a.status === "INTERESTED").length;

  // Filter out blocked users from attendee list
  let blockedIds = new Set<string>();
  if (currentUserId) {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerUserId: currentUserId },
          { blockedUserId: currentUserId },
        ],
      },
      select: { blockerUserId: true, blockedUserId: true },
    });
    blockedIds = new Set(
      blocks.flatMap((b) => [b.blockerUserId, b.blockedUserId]),
    );
    blockedIds.delete(currentUserId);
  }

  const visibleAttendees = meetup.attendees.filter(
    (a) => !blockedIds.has(a.userId),
  );

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="meetup-detail">
      <Link href="/meetups" className="profile-view__back">
        ← Back to meetups
      </Link>

      <div className="meetup-detail__card">
        {isCancelled && (
          <div className="meetup-detail__cancelled">This meetup has been cancelled.</div>
        )}

        <h1 className="meetup-detail__title">{meetup.title}</h1>

        <div className="meetup-detail__meta-group">
          <p className="meetup-detail__meta">📍 {meetup.city}, {meetup.country}</p>
          <p className="meetup-detail__meta">📅 {fmtDate(meetup.dateTime)}</p>
          {meetup.locationHint && (
            <p className="meetup-detail__meta">🗺️ Near: {meetup.locationHint}</p>
          )}
          <p className="meetup-detail__meta">
            👤 Organised by{" "}
            <Link href={`/community/${meetup.createdBy.id}`}>
              {meetup.createdBy.profile?.displayName ?? "Unknown"}
            </Link>
          </p>
        </div>

        <div className="meetup-detail__description">
          <h2>Details</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{meetup.description}</p>
        </div>

        {/* RSVP section */}
        {!isCancelled && !isPast && currentUserId && !isCreator && (
          <RsvpButton
            meetupId={meetup.id}
            currentStatus={
              myAttendance
                ? (myAttendance.status as "GOING" | "INTERESTED")
                : null
            }
          />
        )}

        {/* Creator / admin actions */}
        {!isCancelled && (isCreator || isAdmin) && (
          <div className="meetup-detail__creator-actions">
            <CancelMeetupButton meetupId={meetup.id} />
          </div>
        )}

        {/* Stats */}
        <div className="meetup-detail__stats">
          <span className="tag">{goingCount} going</span>
          <span className="tag">{interestedCount} interested</span>
          {meetup.maxAttendees && (
            <span className="tag">{meetup.maxAttendees} max capacity</span>
          )}
        </div>

        {/* Attendees list */}
        <div className="meetup-detail__attendees">
          <h2>Attendees</h2>
          {visibleAttendees.length === 0 ? (
            <p className="text-muted">No attendees yet.</p>
          ) : (
            <ul className="meetup-detail__attendee-list">
              {visibleAttendees.map((a) => (
                <li key={a.id}>
                  <Link href={`/community/${a.userId}`}>
                    {a.user.profile?.displayName ?? "Unknown"}
                  </Link>
                  <span className="badge badge--sm">
                    {a.status === "GOING" ? "Going" : "Interested"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Report */}
        {currentUserId && !isCreator && (
          <div className="meetup-detail__report">
            <MeetupReportButton meetupId={meetup.id} />
          </div>
        )}
      </div>
    </div>
  );
}
