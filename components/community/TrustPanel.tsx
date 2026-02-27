"use client";

import { ReportButton } from "@/app/community/[userId]/profile-actions";
import { timeAgo } from "@/lib/community-profile";

type Props = {
  emailVerified: boolean;
  phoneVerified: boolean;
  lastActiveAt: Date | null;
  targetUserId: string;
  showReport: boolean;
};

export function TrustPanel({
  emailVerified,
  phoneVerified,
  lastActiveAt,
  targetUserId,
  showReport,
}: Props) {
  return (
    <div className="profile-sidebar-card">
      <h3 className="profile-sidebar-card__title">Verification &amp; Trust</h3>
      <ul className="trust-list">
        <li className="trust-list__item">
          <span className={`trust-list__icon ${emailVerified ? "trust-list__icon--ok" : "trust-list__icon--na"}`}>
            {emailVerified ? "✓" : "○"}
          </span>
          Verified <strong>email</strong>
        </li>
        <li className="trust-list__item">
          <span className={`trust-list__icon ${phoneVerified ? "trust-list__icon--ok" : "trust-list__icon--na"}`}>
            {phoneVerified ? "✓" : "○"}
          </span>
          Verified <strong>phone</strong>
        </li>
        {lastActiveAt && (
          <li className="trust-list__item">
            <span className="trust-list__icon trust-list__icon--neutral">👤</span>
            Last active {timeAgo(lastActiveAt)}
          </li>
        )}
      </ul>
      {showReport && (
        <div className="trust-list__report">
          <ReportButton targetType="USER" targetId={targetUserId} />
        </div>
      )}
    </div>
  );
}
