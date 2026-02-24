import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  ipCidr: z.string().min(1).max(50),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * GET /api/admin/blocked-ips — list all blocked IPs.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const ips = await prisma.blockedIp.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ips });
}

/**
 * POST /api/admin/blocked-ips — block an IP or CIDR range.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { ipCidr, reason, expiresAt } = parsed.data;

  const entry = await prisma.blockedIp.create({
    data: {
      ipCidr,
      reason: reason || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.user.id,
      actionType: "BLOCK_IP",
      targetType: "IP",
      targetId: entry.id,
      metadata: JSON.stringify({ ipCidr, reason }),
    },
  });

  return NextResponse.json({ ok: true, entry }, { status: 201 });
}

/**
 * DELETE /api/admin/blocked-ips — unblock an IP.
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const schema = z.object({ id: z.string().uuid() });
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await prisma.blockedIp.delete({ where: { id: parsed.data.id } });

  return NextResponse.json({ ok: true });
}
