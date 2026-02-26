import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/email/resendClient";

const FROM_ADDRESS = "Globescraper <noreply@globescraper.com>";

/**
 * POST /api/admin/email/send-single
 * Send a single email to one user (by userId) or a manual email address.
 * Supports userId = "ADMIN_SELF" to send to the admin's own email.
 * Supports { email } for manual addresses not in DB (no log created).
 */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();

    const { userId, email: manualEmail, subject, htmlContent, textContent } = await req.json();

    if (!subject || !htmlContent) {
      return NextResponse.json(
        { error: "subject and htmlContent are required." },
        { status: 400 },
      );
    }

    if (!userId && !manualEmail) {
      return NextResponse.json(
        { error: "userId or email is required." },
        { status: 400 },
      );
    }

    const resend = getResendClient();

    // ── Manual email address (no DB user) ──
    if (manualEmail) {
      try {
        await resend.emails.send({
          from: FROM_ADDRESS,
          to: [manualEmail],
          subject,
          html: htmlContent,
          text: textContent || undefined,
        });
        return NextResponse.json({ ok: true });
      } catch (sendErr: unknown) {
        const errMsg = sendErr instanceof Error ? sendErr.message : "Send failed";
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
    }

    // ── ADMIN_SELF: send to the logged-in admin ──
    let targetUser;
    if (userId === "ADMIN_SELF") {
      targetUser = await prisma.user.findUnique({
        where: { email: session.user?.email || "" },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailUnsubscribed: true,
          unsubscribeToken: true,
        },
      });
    } else {
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailUnsubscribed: true,
          unsubscribeToken: true,
        },
      });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Create log entry first
    const log = await prisma.emailLog.create({
      data: {
        userId: targetUser.id,
        type: "TRANSACTIONAL",
        subject,
        status: "PENDING",
      },
    });

    try {
      const result = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [targetUser.email],
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
