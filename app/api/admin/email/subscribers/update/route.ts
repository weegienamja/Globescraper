import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/email/subscribers/update
 * Update subscriber email preferences (opt in/out, suppress/unsuppress).
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { userId, emailMarketingOptIn, emailUnsubscribed } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof emailMarketingOptIn === "boolean") {
      data.emailMarketingOptIn = emailMarketingOptIn;
      if (emailMarketingOptIn) {
        data.marketingOptInAt = new Date();
      }
    }
    if (typeof emailUnsubscribed === "boolean") {
      data.emailUnsubscribed = emailUnsubscribed;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
