import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/email/resendClient";

const FROM_ADDRESS = "Globescraper <noreply@globescraper.com>";
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1000; // 1s between batches

// Safety thresholds
const MAX_CAMPAIGNS_PER_DAY = 3;
const MAX_BOUNCE_RATE = 0.05; // 5%
const MAX_UNSUBSCRIBE_RATE = 0.03; // 3%

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/admin/email/send-campaign
 * Send a campaign to all eligible subscribers in batches.
 */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const { campaignId, skipSafetyChecks } = await req.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId is required." },
        { status: 400 },
      );
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: `Campaign status is ${campaign.status}. Only DRAFT or SCHEDULED campaigns can be sent.` },
        { status: 400 },
      );
    }

    // ── Safety checks ───────────────────────────────────────
    if (!skipSafetyChecks) {
      // Check campaigns sent today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const campaignsToday = await prisma.emailCampaign.count({
        where: {
          status: "SENT",
          sentAt: { gte: todayStart },
        },
      });
      if (campaignsToday >= MAX_CAMPAIGNS_PER_DAY) {
        return NextResponse.json(
          { error: `Daily limit reached (${MAX_CAMPAIGNS_PER_DAY} campaigns per day). Set skipSafetyChecks to override.` },
          { status: 429 },
        );
      }

      // Check bounce rate from last 5 campaigns
      const recentCampaigns = await prisma.emailCampaign.findMany({
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
        take: 5,
        select: { sentCount: true, bounceCount: true },
      });
      if (recentCampaigns.length > 0) {
        const totalSent = recentCampaigns.reduce((s, c) => s + c.sentCount, 0);
        const totalBounced = recentCampaigns.reduce((s, c) => s + c.bounceCount, 0);
        if (totalSent > 0 && totalBounced / totalSent > MAX_BOUNCE_RATE) {
          return NextResponse.json(
            { error: `Bounce rate across last 5 campaigns exceeds ${MAX_BOUNCE_RATE * 100}%. Investigate before sending.` },
            { status: 400 },
          );
        }
      }

      // Check unsubscribe rate
      const recentUnsubs = await prisma.user.count({
        where: {
          emailUnsubscribed: true,
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      const totalOptIn = await prisma.user.count({
        where: { emailMarketingOptIn: true },
      });
      if (totalOptIn > 0 && recentUnsubs / totalOptIn > MAX_UNSUBSCRIBE_RATE) {
        return NextResponse.json(
          { error: `Unsubscribe rate in last 7 days exceeds ${MAX_UNSUBSCRIBE_RATE * 100}%. Review your audience.` },
          { status: 400 },
        );
      }
    }

    // ── Mark as SENDING ─────────────────────────────────────
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });

    // ── Fetch eligible users ────────────────────────────────
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

    if (eligibleUsers.length === 0) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: "SENT", sentAt: new Date(), sentCount: 0 },
      });
      return NextResponse.json({
        ok: true,
        message: "No eligible recipients. Campaign marked as sent.",
        sentCount: 0,
      });
    }

    const resend = getResendClient();
    let sentCount = 0;
    let failCount = 0;

    // ── Send in batches ─────────────────────────────────────
    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (user) => {
          // Inject unsubscribe link
          const unsubLink = `https://globescraper.com/unsubscribe/${user.unsubscribeToken || ""}`;
          const html = campaign.htmlContent.replace(/\{\{unsubscribe_link\}\}/g, unsubLink);
          const text = campaign.textContent?.replace(/\{\{unsubscribe_link\}\}/g, unsubLink);

          const log = await prisma.emailLog.create({
            data: {
              campaignId,
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

            return true;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Send failed";
            await prisma.emailLog.update({
              where: { id: log.id },
              data: { status: "FAILED", error: errMsg },
            });
            return false;
          }
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) sentCount++;
        else failCount++;
      }

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < eligibleUsers.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // ── Mark as SENT ────────────────────────────────────────
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentCount,
      },
    });

    return NextResponse.json({
      ok: true,
      sentCount,
      failCount,
      totalEligible: eligibleUsers.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
