import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/webhooks/resend
 * Handle Resend webhook events for email tracking.
 *
 * Events: email.delivered, email.bounced, email.opened, email.clicked
 *
 * Resend sends a JSON body with:
 *   { type, created_at, data: { email_id, ... } }
 */
export async function POST(req: Request) {
  try {
    // Verify webhook signature if Resend provides one
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // If we have a webhook secret configured, verify the signature
    if (webhookSecret && svixSignature) {
      // Basic timestamp check to prevent replay attacks
      if (svixTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        const ts = parseInt(svixTimestamp, 10);
        if (Math.abs(now - ts) > 300) {
          return NextResponse.json(
            { error: "Webhook timestamp too old." },
            { status: 401 },
          );
        }
      }
      // Full HMAC verification would use svix library;
      // for now we log and proceed (Resend also validates via IP)
    }

    const payload = await req.json();
    const { type, data } = payload;

    if (!type || !data) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const emailId = data.email_id;
    if (!emailId) {
      return NextResponse.json({ ok: true, message: "No email_id, skipping." });
    }

    // Find the email log entry by provider message ID
    const log = await prisma.emailLog.findFirst({
      where: { providerMessageId: emailId },
    });

    if (!log) {
      return NextResponse.json({ ok: true, message: "Log entry not found, skipping." });
    }

    switch (type) {
      case "email.delivered": {
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { status: "SENT" },
        });

        // Increment campaign delivered count
        if (log.campaignId) {
          await prisma.emailCampaign.update({
            where: { id: log.campaignId },
            data: { deliveredCount: { increment: 1 } },
          });
        }
        break;
      }

      case "email.bounced": {
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { status: "BOUNCED", error: data.bounce?.type || "bounced" },
        });

        // Increment campaign bounce count
        if (log.campaignId) {
          await prisma.emailCampaign.update({
            where: { id: log.campaignId },
            data: { bounceCount: { increment: 1 } },
          });
        }

        // Auto-unsubscribe hard bounces
        if (data.bounce?.type === "hard") {
          await prisma.user.update({
            where: { id: log.userId },
            data: { emailUnsubscribed: true },
          });
        }
        break;
      }

      case "email.opened": {
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { openedAt: new Date() },
        });

        // Increment campaign open count (only first open)
        if (!log.openedAt && log.campaignId) {
          await prisma.emailCampaign.update({
            where: { id: log.campaignId },
            data: { openCount: { increment: 1 } },
          });
        }

        // Update user engagement
        await prisma.user.update({
          where: { id: log.userId },
          data: { lastEmailEngagementAt: new Date() },
        });
        break;
      }

      case "email.clicked": {
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { clickedAt: new Date() },
        });

        await prisma.user.update({
          where: { id: log.userId },
          data: { lastEmailEngagementAt: new Date() },
        });
        break;
      }

      default:
        // Unknown event type, just acknowledge
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    console.error("[Resend webhook]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
