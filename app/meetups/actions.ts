"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { meetupSchema } from "@/lib/validations/community";

type ActionResult = { ok: true; id?: string } | { error: string };

async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// ── Create meetup ────────────────────────────────────────────

export async function createMeetup(data: unknown): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  // Check user is not disabled
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabled: true, profile: { select: { displayName: true } } },
  });
  if (!user || user.disabled)
    return { error: "Account disabled" };
  if (!user.profile?.displayName)
    return { error: "Please set up your community profile first" };

  const parsed = meetupSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { title, description, country, city, dateTime, locationHint, maxAttendees, visibility } =
    parsed.data;

  const meetup = await prisma.meetup.create({
    data: {
      createdByUserId: userId,
      title,
      description,
      country,
      city,
      dateTime: new Date(dateTime),
      locationHint: locationHint || null,
      maxAttendees: maxAttendees ?? null,
      visibility: visibility as "MEMBERS_ONLY" | "PUBLIC",
    },
  });

  // Creator auto-attends
  await prisma.meetupAttendee.create({
    data: { meetupId: meetup.id, userId, status: "GOING" },
  });

  return { ok: true, id: meetup.id };
}

// ── Update meetup ────────────────────────────────────────────

export async function updateMeetup(
  meetupId: string,
  data: unknown,
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) return { error: "Meetup not found" };
  if (meetup.createdByUserId !== userId)
    return { error: "Only the creator can edit this meetup" };
  if (meetup.status === "CANCELLED")
    return { error: "Cannot edit a cancelled meetup" };

  const parsed = meetupSchema.safeParse(data);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { title, description, country, city, dateTime, locationHint, maxAttendees, visibility } =
    parsed.data;

  await prisma.meetup.update({
    where: { id: meetupId },
    data: {
      title,
      description,
      country,
      city,
      dateTime: new Date(dateTime),
      locationHint: locationHint || null,
      maxAttendees: maxAttendees ?? null,
      visibility: visibility as "MEMBERS_ONLY" | "PUBLIC",
    },
  });

  return { ok: true };
}

// ── Cancel meetup ────────────────────────────────────────────

export async function cancelMeetup(meetupId: string): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const session = await auth();
  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) return { error: "Meetup not found" };

  // Creator or admin can cancel
  if (meetup.createdByUserId !== userId && session?.user?.role !== "ADMIN")
    return { error: "Not authorized" };

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { status: "CANCELLED" },
  });

  return { ok: true };
}

// ── RSVP to meetup ───────────────────────────────────────────

export async function rsvpMeetup(
  meetupId: string,
  status: "GOING" | "INTERESTED",
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    include: { _count: { select: { attendees: { where: { status: "GOING" } } } } },
  });
  if (!meetup || meetup.status === "CANCELLED")
    return { error: "Meetup not found or cancelled" };

  // Check capacity
  if (
    status === "GOING" &&
    meetup.maxAttendees &&
    meetup._count.attendees >= meetup.maxAttendees
  ) {
    return { error: "This meetup is full" };
  }

  await prisma.meetupAttendee.upsert({
    where: { meetupId_userId: { meetupId, userId } },
    create: { meetupId, userId, status },
    update: { status },
  });

  return { ok: true };
}

// ── Leave meetup ─────────────────────────────────────────────

export async function leaveMeetup(meetupId: string): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Not authenticated" };

  const meetup = await prisma.meetup.findUnique({ where: { id: meetupId } });
  if (!meetup) return { error: "Meetup not found" };

  // Creator cannot leave their own meetup
  if (meetup.createdByUserId === userId)
    return { error: "Creator cannot leave. Cancel the meetup instead." };

  await prisma.meetupAttendee.deleteMany({
    where: { meetupId, userId },
  });

  return { ok: true };
}
