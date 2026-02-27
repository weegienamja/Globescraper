import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { areConnected, isBlocked } from "@/lib/connections";
import { getDmRatelimit } from "@/lib/rate-limit";
import { z } from "zod";

const sendSchema = z.object({
  toUserId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  body: z.string().min(1).max(2000),
});

/**
 * GET /api/messages/[conversationId] — get messages for a conversation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const userId = session.user.id;

  // Verify user is a participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant)
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const take = 50;

  const messages = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      senderId: true,
      body: true,
      createdAt: true,
      sender: {
        select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true } } },
      },
    },
  });

  // Update lastReadAt
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ messages, nextCursor: messages.length === take ? messages[messages.length - 1]?.id : null });
}

/**
 * POST /api/messages/[conversationId] — send a message to a conversation.
 * Also supports creating a new DM by passing toUserId (conversationId = "new").
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId: paramConvId } = await params;
  const userId = session.user.id;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  // Rate limit
  const limiter = getDmRatelimit();
  if (limiter) {
    const { success } = await limiter.limit(userId);
    if (!success)
      return NextResponse.json({ error: "Sending messages too fast. Slow down." }, { status: 429 });
  }

  let conversationId = paramConvId === "new" ? null : paramConvId;
  const { toUserId, body: messageBody } = parsed.data;

  // If creating a new conversation
  if (!conversationId && toUserId) {
    if (toUserId === userId)
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });

    // Check connection
    if (!(await areConnected(userId, toUserId)))
      return NextResponse.json({ error: "You must be connected to message this user" }, { status: 403 });

    // Check blocks
    if (await isBlocked(userId, toUserId))
      return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });

    // Check for existing DM conversation between these users
    const existing = await prisma.conversation.findFirst({
      where: {
        type: "DM",
        participants: { every: { userId: { in: [userId, toUserId] } } },
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: toUserId } } },
        ],
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === 2) {
      conversationId = existing.id;
    } else {
      // Create conversation with both participants
      const newConv = await prisma.conversation.create({
        data: {
          type: "DM",
          participants: {
            create: [
              { userId },
              { userId: toUserId },
            ],
          },
        },
      });
      conversationId = newConv.id;
    }
  }

  if (!conversationId)
    return NextResponse.json({ error: "conversationId or toUserId required" }, { status: 400 });

  // Verify user is a participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant)
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // Verify connection still valid (for DMs)
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conv)
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  if (conv.type === "DM") {
    const otherParticipant = conv.participants.find((p) => p.userId !== userId);
    if (otherParticipant) {
      if (!(await areConnected(userId, otherParticipant.userId)))
        return NextResponse.json({ error: "You must be connected to message this user" }, { status: 403 });
      if (await isBlocked(userId, otherParticipant.userId))
        return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
    }
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      body: messageBody,
    },
    select: {
      id: true,
      senderId: true,
      body: true,
      createdAt: true,
    },
  });

  // Update sender's lastReadAt
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  // Auto-calculate reply time hint (fire-and-forget, don't block response)
  updateReplyTimeHint(userId, conversationId).catch(() => {});

  return NextResponse.json({ message, conversationId }, { status: 201 });
}

/**
 * Compute the user's median reply time across recent conversations and
 * update their profile.replyTimeHint automatically.
 */
async function updateReplyTimeHint(userId: string, currentConversationId: string) {
  // Get conversations the user participates in
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
    take: 20,
  });

  const convIds = participations.map((p) => p.conversationId);
  if (convIds.length === 0) return;

  // For each conversation, find pairs where someone else sent a message
  // and then the user replied — measure the gap.
  const replyDeltas: number[] = [];

  for (const convId of convIds) {
    // Get last 30 messages in this conversation (enough to find reply patterns)
    const messages = await prisma.message.findMany({
      where: { conversationId: convId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { senderId: true, createdAt: true },
    });

    // Walk through messages and find reply gaps
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      // Current message is from this user, previous was from someone else
      if (curr.senderId === userId && prev.senderId !== userId) {
        const deltaMs = curr.createdAt.getTime() - prev.createdAt.getTime();
        // Only count reasonable gaps (< 7 days)
        if (deltaMs > 0 && deltaMs < 7 * 24 * 60 * 60 * 1000) {
          replyDeltas.push(deltaMs);
        }
      }
    }

    // Cap total samples
    if (replyDeltas.length >= 50) break;
  }

  if (replyDeltas.length < 3) return; // Not enough data yet

  // Compute median
  replyDeltas.sort((a, b) => a - b);
  const median = replyDeltas[Math.floor(replyDeltas.length / 2)];

  const ONE_HOUR = 60 * 60 * 1000;
  const FEW_HOURS = 4 * ONE_HOUR;
  const ONE_DAY = 24 * ONE_HOUR;

  let hint: "WITHIN_HOUR" | "WITHIN_FEW_HOURS" | "WITHIN_DAY" | "NOT_ACTIVE";
  if (median <= ONE_HOUR) hint = "WITHIN_HOUR";
  else if (median <= FEW_HOURS) hint = "WITHIN_FEW_HOURS";
  else if (median <= ONE_DAY) hint = "WITHIN_DAY";
  else hint = "NOT_ACTIVE";

  await prisma.profile.updateMany({
    where: { userId },
    data: { replyTimeHint: hint },
  });
}
