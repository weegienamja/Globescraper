"use client";

interface MetricCard {
  label: string;
  value: number;
  icon: string;
  changePercent: number;
}

interface Props {
  stats: {
    totalUsers: number;
    optedIn: number;
    eligible: number;
    unsubscribed: number;
    verified: number;
    totalUsersLastWeek: number;
    optedInLastWeek: number;
    eligibleLastWeek: number;
    unsubscribedLastWeek: number;
    verifiedLastWeek: number;
  };
}

function pctChange(current: number, lastWeek: number): number {
  if (lastWeek === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - lastWeek) / lastWeek) * 100);
}

export function EmailMetrics({ stats }: Props) {
  const cards: MetricCard[] = [
    {
      label: "Total Subscribers",
      value: stats.totalUsers,
      icon: "👥",
      changePercent: pctChange(stats.totalUsers, stats.totalUsersLastWeek),
    },
    {
      label: "Opted In",
      value: stats.optedIn,
      icon: "✅",
      changePercent: pctChange(stats.optedIn, stats.optedInLastWeek),
    },
    {
      label: "Eligible",
      value: stats.eligible,
      icon: "🎯",
      changePercent: pctChange(stats.eligible, stats.eligibleLastWeek),
    },
    {
      label: "Unsubscribed",
      value: stats.unsubscribed,
      icon: "🚫",
      changePercent: pctChange(stats.unsubscribed, stats.unsubscribedLastWeek),
    },
    {
      label: "Email Verified",
      value: stats.verified,
      icon: "📧",
      changePercent: pctChange(stats.verified, stats.verifiedLastWeek),
    },
  ];

  return (
    <div className="em-metrics">
      {cards.map((card) => (
        <div key={card.label} className="em-metrics__card">
          <div className="em-metrics__icon">{card.icon}</div>
          <div className="em-metrics__value">{card.value}</div>
          <div className="em-metrics__label">{card.label}</div>
          <div
            className={`em-metrics__change ${
              card.changePercent > 0
                ? "em-metrics__change--up"
                : card.changePercent < 0
                  ? "em-metrics__change--down"
                  : ""
            }`}
          >
            {card.changePercent > 0 ? "↑" : card.changePercent < 0 ? "↓" : "—"}{" "}
            {Math.abs(card.changePercent)}% this week
          </div>
        </div>
      ))}
    </div>
  );
}
