import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canonicalPair, isBlocked, isUserActive } from "@/lib/connections";
import { getConnectionRatelimit } from "@/lib/rate-limit";
import { z } from "zod";

const sendSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().max(300).optional(),
});

const respondSchema = z.object({
  connectionId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

const removeSchema = z.object({
  connectionId: z.string().uuid(),
});

/**
 * GET /api/connections — list connections for the current user.
 * ?type=pending-received | pending-sent | accepted
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "accepted";
  const userId = session.user.id;

  if (type === "pending-received") {
    const rows = await prisma.connection.findMany({
      where: {
        status: "PENDING",
        requestedByUserId: { not: userId },
        OR: [{ userLowId: userId }, { userHighId: userId }],
      },
      include: {
        userLow: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true, currentCountry: true, currentCity: true } } } },
        userHigh: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true, currentCountry: true, currentCity: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const items = rows.map((r) => {
      const other = r.userLowId === userId ? r.userHigh : r.userLow;
      return { id: r.id, user: other, createdAt: r.createdAt };
    });

    return NextResponse.json({ items });
  }

  if (type === "pending-sent") {
    const rows = await prisma.connection.findMany({
      where: {
        status: "PENDING",
        requestedByUserId: userId,
      },
      include: {
        userLow: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        userHigh: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const items = rows.map((r) => {
      const other = r.userLowId === userId ? r.userHigh : r.userLow;
      return { id: r.id, user: other, status: r.status, createdAt: r.createdAt };
    });

    return NextResponse.json({ items });
  }

  // Default: accepted connections
  const rows = await prisma.connection.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
    include: {
      userLow: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      userHigh: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } } },
    },
    orderBy: { acceptedAt: "desc" },
  });

  const items = rows.map((r) => {
    const other = r.userLowId === userId ? r.userHigh : r.userLow;
    return { id: r.id, user: other, acceptedAt: r.acceptedAt };
  });

  return NextResponse.json({ items });
}

/**
 * POST /api/connections — send a connection request.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const userId = session.user.id;
  const { toUserId, message } = parsed.data;

  if (toUserId === userId)
    return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });

  // Rate limit
  const limiter = getConnectionRatelimit();
  if (limiter) {
    const { success } = await limiter.limit(userId);
    if (!success)
      return NextResponse.json({ error: "Too many connection requests today. Try again tomorrow." }, { status: 429 });
  }

  // Check blocks
  if (await isBlocked(userId, toUserId))
    return NextResponse.json({ error: "Cannot send request to this user" }, { status: 403 });

  // Check target is active
  if (!(await isUserActive(toUserId)))
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [low, high] = canonicalPair(userId, toUserId);

  // Check for existing connection
  const existing = await prisma.connection.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
  });

  if (existing) {
    if (existing.status === "ACCEPTED")
      return NextResponse.json({ error: "Already connected" }, { status: 409 });
    if (existing.status === "PENDING")
      return NextResponse.json({ error: "Request already pending" }, { status: 409 });
    // REJECTED — allow re-request
    await prisma.connection.update({
      where: { id: existing.id },
      data: { status: "PENDING", requestedByUserId: userId },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.connection.create({
    data: {
      userLowId: low,
      userHighId: high,
      requestedByUserId: userId,
    },
  });

  // Also maintain compatibility with legacy ConnectionRequest table
  // for any code still referencing it
  try {
    await prisma.connectionRequest.upsert({
      where: { fromUserId_toUserId: { fromUserId: userId, toUserId } },
      create: { fromUserId: userId, toUserId, message: message || null },
      update: { status: "PENDING", message: message || null },
    });
  } catch {
    // Non-critical — legacy table may not have the pair
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/**
 * PATCH /api/connections — respond to a pending request (accept/reject).
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = respondSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const userId = session.user.id;
  const { connectionId, action } = parsed.data;

  const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!conn)
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  // Only the non-requester can respond
  const isParticipant = conn.userLowId === userId || conn.userHighId === userId;
  if (!isParticipant || conn.requestedByUserId === userId)
    return NextResponse.json({ error: "You cannot respond to this request" }, { status: 403 });

  if (conn.status !== "PENDING")
    return NextResponse.json({ error: "Request already handled" }, { status: 409 });

  if (action === "accept") {
    await prisma.connection.update({
      where: { id: connectionId },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    // Sync legacy table
    const fromUserId = conn.requestedByUserId;
    const toUserId = userId;
    try {
      await prisma.connectionRequest.updateMany({
        where: {
          OR: [
            { fromUserId, toUserId },
            { fromUserId: toUserId, toUserId: fromUserId },
          ],
          status: "PENDING",
        },
        data: { status: "ACCEPTED" },
      });
    } catch { /* non-critical */ }
  } else {
    await prisma.connection.update({
      where: { id: connectionId },
      data: { status: "REJECTED" },
    });

    // Sync legacy table
    try {
      await prisma.connectionRequest.updateMany({
        where: {
          OR: [
            { fromUserId: conn.requestedByUserId, toUserId: userId },
            { fromUserId: userId, toUserId: conn.requestedByUserId },
          ],
          status: "PENDING",
        },
        data: { status: "DECLINED" },
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/connections — remove an accepted connection.
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = removeSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const userId = session.user.id;
  const { connectionId } = parsed.data;

  const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!conn)
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  const isParticipant = conn.userLowId === userId || conn.userHighId === userId;
  if (!isParticipant)
    return NextResponse.json({ error: "Not your connection" }, { status: 403 });

  if (conn.status !== "ACCEPTED")
    return NextResponse.json({ error: "Connection is not active" }, { status: 400 });

  // Delete the connection
  await prisma.connection.delete({ where: { id: connectionId } });

  // Sync legacy table — delete accepted record
  const otherId = conn.userLowId === userId ? conn.userHighId : conn.userLowId;
  try {
    await prisma.connectionRequest.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherId },
          { fromUserId: otherId, toUserId: userId },
        ],
        status: "ACCEPTED",
      },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true });
}
