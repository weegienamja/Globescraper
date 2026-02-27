import { timeAgo } from "@/lib/community-profile";

type ActivityItem = {
  id: string;
  eventType: string;
  title: string;
  linkUrl: string | null;
  createdAt: Date;
};

type Props = {
  events: ActivityItem[];
  displayName: string;
};

const EVENT_ICONS: Record<string, string> = {
  COMMENTED: "💬",
  RSVP: "🎉",
  POSTED: "📝",
  CONNECTED: "🤝",
};

export function ActivityFeed({ events, displayName }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="profile-section">
      <h2 className="profile-section__title">Recent Activity</h2>
      <ul className="activity-feed">
        {events.map((event) => (
          <li key={event.id} className="activity-feed__item">
            <span className="activity-feed__icon">
              {EVENT_ICONS[event.eventType] ?? "📋"}
            </span>
            <div className="activity-feed__content">
              <p className="activity-feed__text">
                <strong>{displayName}</strong>{" "}
                {event.linkUrl ? (
                  <a href={event.linkUrl} className="activity-feed__link">
                    {event.title}
                  </a>
                ) : (
                  event.title
                )}
              </p>
              <time className="activity-feed__time">{timeAgo(event.createdAt)}</time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
