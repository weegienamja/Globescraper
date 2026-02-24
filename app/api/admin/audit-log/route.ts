import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/audit-log — list admin audit log entries.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const take = 50;
  const skip = (page - 1) * take;

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        admin: { select: { name: true, email: true } },
      },
    }),
    prisma.adminAuditLog.count(),
  ]);

  return NextResponse.json({ entries, total, page, pages: Math.ceil(total / take) });
}
