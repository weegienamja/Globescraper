import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED", "DELETED", ""]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const editSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().max(100).optional(),
  email: z.string().email().max(255).optional(),
  bio: z.string().max(500).optional().nullable(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
  disabled: z.boolean().optional(),
});

/**
 * GET /api/admin/users — search/list users.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "",
    page: searchParams.get("page") ?? "1",
  });
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { q, status, page } = parsed.data;
  const take = 25;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        disabled: true,
        deletedAt: true,
        lastLoginAt: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            currentCountry: true,
            currentCity: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / take) });
}

/**
 * PATCH /api/admin/users — edit a user (admin only).
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = editSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { userId, ...fields } = parsed.data;
  const adminId = session.user.id;

  // Fetch current state for audit log
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true, status: true, disabled: true },
  });
  if (!before)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.email !== undefined) updateData.email = fields.email;
  if (fields.role !== undefined) updateData.role = fields.role;
  if (fields.disabled !== undefined) updateData.disabled = fields.disabled;

  if (fields.status !== undefined) {
    updateData.status = fields.status;
    if (fields.status === "BANNED" || fields.status === "SUSPENDED") {
      updateData.disabled = true;
    }
  }

  if (Object.keys(updateData).length === 0 && fields.bio === undefined)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  // Update user
  const after = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { name: true, email: true, role: true, status: true, disabled: true },
  });

  // Update bio on profile if provided
  if (fields.bio !== undefined) {
    await prisma.profile.updateMany({
      where: { userId },
      data: { bio: fields.bio },
    });
  }

  // If banned or suspended, invalidate sessions and set profile to private
  if (fields.status === "BANNED" || fields.status === "SUSPENDED") {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.profile.updateMany({
      where: { userId },
      data: { visibility: "PRIVATE" },
    });
  }

  // Audit log
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      actionType: "EDIT_USER",
      targetType: "USER",
      targetId: userId,
      targetUserId: userId,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
    },
  });

  return NextResponse.json({ ok: true, user: after });
}

/**
 * DELETE /api/admin/users — soft-delete a user (admin only).
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const schema = z.object({
    userId: z.string().uuid(),
    anonymizeMessages: z.boolean().default(false),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { userId, anonymizeMessages } = parsed.data;
  const adminId = session.user.id;

  if (userId === adminId)
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Soft delete
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "DELETED",
      disabled: true,
      deletedAt: new Date(),
    },
  });

  // Invalidate sessions
  await prisma.session.deleteMany({ where: { userId } });

  // Set profile to private
  await prisma.profile.updateMany({
    where: { userId },
    data: { visibility: "PRIVATE" },
  });

  // Delete connections
  await prisma.connection.deleteMany({
    where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
  });

  // Delete legacy connection requests
  await prisma.connectionRequest.deleteMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
  });

  // Optionally anonymize messages
  if (anonymizeMessages) {
    await prisma.message.updateMany({
      where: { senderId: userId },
      data: { body: "[deleted]", deletedAt: new Date() },
    });
  }

  // Audit log
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      actionType: "DELETE_USER",
      targetType: "USER",
      targetId: userId,
      targetUserId: userId,
      beforeJson: JSON.stringify(user),
      afterJson: JSON.stringify({ status: "DELETED", deletedAt: new Date().toISOString() }),
    },
  });

  return NextResponse.json({ ok: true });
}
