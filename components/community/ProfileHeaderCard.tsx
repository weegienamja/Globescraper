"use client";

import Image from "next/image";
import Link from "next/link";
import { ConnectButton, ReportButton } from "@/app/community/[userId]/profile-actions";

type Props = {
  displayName: string;
  avatarUrl: string | null;
  location: string;
  relocationStageLabel: string;
  memberSince: string;
  replyTimeLabel: string | null;
  emailVerified: boolean;
  userId: string;
  isOwner: boolean;
  connectionStatus: string | null;
  isBlockedByMe: boolean;
  hideActions?: boolean;
};

export function ProfileHeaderCard({
  displayName,
  avatarUrl,
  location,
  relocationStageLabel,
  memberSince,
  replyTimeLabel,
  emailVerified,
  userId,
  isOwner,
  connectionStatus,
  isBlockedByMe,
  hideActions,
}: Props) {
  return (
    <div className="profile-header-card">
      <div className="profile-header-card__top">
        <div className="profile-header-card__avatar-wrap">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={96}
              height={96}
              className="profile-header-card__avatar-img"
            />
          ) : (
            <div className="profile-header-card__avatar-fallback">
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {emailVerified && (
            <span className="profile-header-card__verified-badge" title="Verified">
              ✓
            </span>
          )}
        </div>

        <div className="profile-header-card__info">
          <div className="profile-header-card__name-row">
            <h1 className="profile-header-card__name">
              {displayName}
              {emailVerified && (
                <span className="profile-header-card__verified-icon" title="Verified email">
                  ⚙
                </span>
              )}
            </h1>
          </div>
          {location && (
            <p className="profile-header-card__location">📍 {location}</p>
          )}
          <span className="profile-header-card__stage-pill">{relocationStageLabel}</span>
          <p className="profile-header-card__meta">
            👤 Member since {memberSince}
            {replyTimeLabel && ` · ${replyTimeLabel}`}
          </p>
        </div>

        <div className="profile-header-card__actions">
          {hideActions ? null : isOwner ? (
            <Link href="/community/edit-profile" className="btn btn--primary btn--sm">
              Edit profile
            </Link>
          ) : (
            <>
              {connectionStatus === "ACCEPTED" ? (
                <>
                  <span className="badge badge--ok">✓ Connected</span>
                  <Link
                    href={`/dashboard/messages?to=${userId}`}
                    className="btn btn--outline btn--sm"
                  >
                    💬 Message
                  </Link>
                </>
              ) : connectionStatus === "PENDING" ? (
                <span className="badge badge--muted">⏳ Request pending</span>
              ) : !isBlockedByMe ? (
                <>
                  <ConnectButton toUserId={userId} />
                  <Link
                    href={`/dashboard/messages?to=${userId}`}
                    className="btn btn--outline btn--sm"
                  >
                    💬 Message
                  </Link>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
