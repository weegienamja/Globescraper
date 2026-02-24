"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDisableUser, adminCancelMeetup, adminDismissReport } from "./admin-actions";

export function AdminReportActions({
  reportId,
  targetType,
  targetId,
}: {
  reportId: string;
  targetType: "USER" | "MEETUP";
  targetId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDisableUser() {
    startTransition(async () => {
      await adminDisableUser(targetId);
      router.refresh();
    });
  }

  function handleCancelMeetup() {
    startTransition(async () => {
      await adminCancelMeetup(targetId);
      router.refresh();
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await adminDismissReport(reportId);
      router.refresh();
    });
  }

  return (
    <div className="admin__report-actions">
      {targetType === "USER" && (
        <button
          onClick={handleDisableUser}
          disabled={pending}
          className="btn btn--danger btn--sm"
        >
          Disable user
        </button>
      )}
      {targetType === "MEETUP" && (
        <button
          onClick={handleCancelMeetup}
          disabled={pending}
          className="btn btn--danger btn--sm"
        >
          Cancel meetup
        </button>
      )}
      <button
        onClick={handleDismiss}
        disabled={pending}
        className="btn btn--outline btn--sm"
      >
        Dismiss
      </button>
    </div>
  );
}
