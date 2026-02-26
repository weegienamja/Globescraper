import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/email/resendClient";

const FROM_ADDRESS = "Globescraper <noreply@globescraper.com>";

/**
 * POST /api/admin/email/send-single
 * Send a single email to one user.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { userId, subject, htmlContent, textContent } = await req.json();

    if (!userId || !subject || !htmlContent) {
      return NextResponse.json(
        { error: "userId, subject, and htmlContent are required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        emailUnsubscribed: true,
        unsubscribeToken: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "User email is not verified." },
        { status: 400 },
      );
    }

    const resend = getResendClient();

    // Create log entry first
    const log = await prisma.emailLog.create({
      data: {
        userId: user.id,
        type: "TRANSACTIONAL",
        subject,
        status: "PENDING",
      },
    });

    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [user.email],
        subject,
        html: htmlContent,
        text: textContent || undefined,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: "SENT",
          providerMessageId: result.data?.id || null,
        },
      });

      return NextResponse.json({ ok: true, logId: log.id });
    } catch (sendErr: unknown) {
      const errMsg = sendErr instanceof Error ? sendErr.message : "Send failed";
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "FAILED", error: errMsg },
      });
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
