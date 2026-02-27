import Image from "next/image";
import Link from "next/link";

type ConnectionPreview = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

type Props = {
  connections: ConnectionPreview[];
  totalCount: number;
  mutualCount: number;
  profileUserId: string;
};

export function ConnectionsPreview({
  connections,
  totalCount,
  mutualCount,
  profileUserId,
}: Props) {
  return (
    <div className="profile-sidebar-card">
      <h3 className="profile-sidebar-card__title">Connections</h3>
      {connections.length > 0 ? (
        <>
          <div className="connections-preview__avatars">
            {connections.map((c) => (
              <Link
                key={c.userId}
                href={`/community/${c.userId}`}
                className="connections-preview__avatar-link"
                title={c.displayName}
              >
                {c.avatarUrl ? (
                  <Image
                    src={c.avatarUrl}
                    alt={c.displayName}
                    width={36}
                    height={36}
                    className="connections-preview__avatar-img"
                  />
                ) : (
                  <span className="connections-preview__avatar-fallback">
                    {c.displayName[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </Link>
            ))}
            {connections.length > 0 && connections.length < totalCount && (
              <span className="connections-preview__name">
                {connections[0].displayName}
              </span>
            )}
          </div>
          {mutualCount > 0 && (
            <p className="connections-preview__mutual">
              {mutualCount} mutual connection{mutualCount !== 1 ? "s" : ""} »
            </p>
          )}
          <div className="connections-preview__actions">
            <Link
              href={`/community/${profileUserId}`}
              className="btn btn--outline btn--sm connections-preview__view-btn"
            >
              View
            </Link>
          </div>
        </>
      ) : (
        <p className="connections-preview__empty">No connections yet</p>
      )}
    </div>
  );
}
