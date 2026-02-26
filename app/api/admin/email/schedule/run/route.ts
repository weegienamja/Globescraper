import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/email/resendClient";

const FROM_ADDRESS = "Globescraper <noreply@globescraper.com>";
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/admin/email/schedule/run
 * Check for scheduled campaigns ready to send and trigger them.
 * Can be called by a cron job (e.g., Vercel cron) every minute.
 */
export async function POST(req: Request) {
  try {
    // Allow both admin calls and cron calls with a secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader === `Bearer ${cronSecret}` && cronSecret) {
      // Cron access OK
    } else {
      await requireAdmin();
    }

    const now = new Date();

    const readyCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
    });

    if (readyCampaigns.length === 0) {
      return NextResponse.json({ ok: true, message: "No campaigns ready to send." });
    }

    const results = [];

    for (const campaign of readyCampaigns) {
      // Mark as SENDING
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: "SENDING" },
      });

      const eligibleUsers = await prisma.user.findMany({
        where: {
          emailMarketingOptIn: true,
          emailUnsubscribed: false,
          emailVerified: { not: null },
          status: "ACTIVE",
        },
        select: {
          id: true,
          email: true,
          unsubscribeToken: true,
        },
      });

      const resend = getResendClient();
      let sentCount = 0;

      for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
        const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

        await Promise.allSettled(
          batch.map(async (user) => {
            const unsubLink = `https://globescraper.com/unsubscribe/${user.unsubscribeToken || ""}`;
            const html = campaign.htmlContent.replace(/\{\{unsubscribe_link\}\}/g, unsubLink);
            const text = campaign.textContent?.replace(/\{\{unsubscribe_link\}\}/g, unsubLink);

            const log = await prisma.emailLog.create({
              data: {
                campaignId: campaign.id,
                userId: user.id,
                type: "MARKETING",
                subject: campaign.subject,
                status: "PENDING",
              },
            });

            try {
              const result = await resend.emails.send({
                from: FROM_ADDRESS,
                to: [user.email],
                subject: campaign.subject,
                html,
                text: text || undefined,
                headers: {
                  "List-Unsubscribe": `<${unsubLink}>`,
                },
              });

              await prisma.emailLog.update({
                where: { id: log.id },
                data: {
                  status: "SENT",
                  providerMessageId: result.data?.id || null,
                },
              });
              sentCount++;
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : "Send failed";
              await prisma.emailLog.update({
                where: { id: log.id },
                data: { status: "FAILED", error: errMsg },
              });
            }
          }),
        );

        if (i + BATCH_SIZE < eligibleUsers.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          sentCount,
        },
      });

      results.push({ campaignId: campaign.id, sentCount });
    }

    return NextResponse.json({ ok: true, processed: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
