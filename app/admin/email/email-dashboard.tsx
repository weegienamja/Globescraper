"use client";

import { useState } from "react";
import { EmailMetrics } from "@/components/admin/email/EmailMetrics";
import { SingleEmailForm } from "@/components/admin/email/SingleEmailForm";
import { CampaignBuilder } from "@/components/admin/email/CampaignBuilder";
import { SubscriberTable } from "@/components/admin/email/SubscriberTable";
import { SuppressionList } from "@/components/admin/email/SuppressionList";
import { AnalyticsDashboard } from "@/components/admin/email/AnalyticsDashboard";

/* ── Types ────────────────────────────────────────────────── */

type Tab = "single" | "campaigns" | "subscribers" | "suppression" | "analytics";

interface Campaign {
  id: string;
  subject: string;
  previewText: string | null;
  htmlContent: string;
  textContent: string | null;
  status: string;
  segmentJson: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  bounceCount: number;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  optedIn: number;
  unsubscribed: number;
  verified: number;
  eligible: number;
  totalUsersLastWeek: number;
  optedInLastWeek: number;
  unsubscribedLastWeek: number;
  verifiedLastWeek: number;
  eligibleLastWeek: number;
}

interface UserEntry {
  id: string;
  email: string;
  name: string | null;
  emailMarketingOptIn: boolean;
  emailUnsubscribed: boolean;
}

interface Subscriber {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  emailVerified: string | null;
  emailMarketingOptIn: boolean;
  emailUnsubscribed: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

interface Suppressed {
  id: string;
  email: string;
  name: string | null;
  reason: "unsubscribed" | "bounced" | "complaint" | "manual";
  date: string;
}

interface EmailLogRow {
  id: string;
  subject: string | null;
  type: string;
  status: string;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

interface DailyStat {
  date: string;
  sent: number;
  opened: number;
  bounced: number;
}

/* ── Main Component ───────────────────────────────────────── */

export function AdminEmailDashboard({
  initialCampaigns,
  initialStats,
  initialUsers,
  initialSubscribers,
  initialSuppressed,
  initialLogs,
  dailyStats,
}: {
  initialCampaigns: Campaign[];
  initialStats: Stats;
  initialUsers: UserEntry[];
  initialSubscribers: Subscriber[];
  initialSuppressed: Suppressed[];
  initialLogs: EmailLogRow[];
  dailyStats: DailyStat[];
}) {
  const [tab, setTab] = useState<Tab>("single");

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "single", label: "Single Email", icon: "✉️" },
    { key: "campaigns", label: "Campaigns", icon: "📨" },
    { key: "subscribers", label: "Subscribers", icon: "👥" },
    { key: "suppression", label: "Suppression", icon: "🚫" },
    { key: "analytics", label: "Analytics", icon: "📊" },
  ];

  return (
    <>
      {/* Metrics row */}
      <EmailMetrics stats={initialStats} />

      {/* Tabs */}
      <div className="email-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`email-tabs__btn ${tab === t.key ? "email-tabs__btn--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="email-tabs__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="email-panel">
        {tab === "single" && <SingleEmailForm users={initialUsers} />}
        {tab === "campaigns" && (
          <CampaignBuilder
            initialCampaigns={initialCampaigns}
            eligibleCount={initialStats.eligible}
          />
        )}
        {tab === "subscribers" && (
          <SubscriberTable initialSubscribers={initialSubscribers} />
        )}
        {tab === "suppression" && (
          <SuppressionList initialList={initialSuppressed} />
        )}
        {tab === "analytics" && (
          <AnalyticsDashboard
            logs={initialLogs}
            campaigns={initialCampaigns}
            dailyStats={dailyStats}
          />
        )}
      </div>
    </>
  );
}
