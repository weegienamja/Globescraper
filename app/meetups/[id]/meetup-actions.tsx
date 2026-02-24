"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rsvpMeetup, leaveMeetup, cancelMeetup } from "@/app/meetups/actions";
import { submitReport } from "@/app/community/actions";
import { REPORT_REASON_LABELS } from "@/lib/validations/community";

export function RsvpButton({
  meetupId,
  currentStatus,
}: {
  meetupId: string;
  currentStatus: "GOING" | "INTERESTED" | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleRsvp(status: "GOING" | "INTERESTED") {
    startTransition(async () => {
      await rsvpMeetup(meetupId, status);
      router.refresh();
    });
  }

  function handleLeave() {
    startTransition(async () => {
      await leaveMeetup(meetupId);
      router.refresh();
    });
  }

  return (
    <div className="meetup-detail__rsvp">
      {currentStatus ? (
        <>
          <span className="badge badge--ok">
            {currentStatus === "GOING" ? "✓ Going" : "👀 Interested"}
          </span>
          {currentStatus === "INTERESTED" && (
            <button
              onClick={() => handleRsvp("GOING")}
              disabled={pending}
              className="btn btn--primary btn--sm"
            >
              Change to Going
            </button>
          )}
          {currentStatus === "GOING" && (
            <button
              onClick={() => handleRsvp("INTERESTED")}
              disabled={pending}
              className="btn btn--outline btn--sm"
            >
              Change to Interested
            </button>
          )}
          <button
            onClick={handleLeave}
            disabled={pending}
            className="btn btn--ghost btn--sm"
          >
            Leave meetup
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => handleRsvp("GOING")}
            disabled={pending}
            className="btn btn--primary btn--sm"
          >
            {pending ? "..." : "I'm going"}
          </button>
          <button
            onClick={() => handleRsvp("INTERESTED")}
            disabled={pending}
            className="btn btn--outline btn--sm"
          >
            Interested
          </button>
        </>
      )}
    </div>
  );
}

export function CancelMeetupButton({ meetupId }: { meetupId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  function handleCancel() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    startTransition(async () => {
      await cancelMeetup(meetupId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleCancel}
      disabled={pending}
      className="btn btn--danger btn--sm"
    >
      {pending ? "Cancelling..." : confirmed ? "Confirm cancel?" : "Cancel meetup"}
    </button>
  );
}

export function MeetupReportButton({ meetupId }: { meetupId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitReport({
        targetType: "MEETUP",
        targetId: meetupId,
        reason,
        details,
      });
      if ("error" in res) {
        setResult(res.error);
      } else {
        setResult("Report submitted. Thank you.");
        setShowForm(false);
      }
    });
  }

  if (result === "Report submitted. Thank you.") {
    return <span className="badge badge--muted">✓ Reported</span>;
  }

  return (
    <>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="btn btn--ghost btn--sm"
        >
          Report
        </button>
      ) : (
        <div className="inline-form">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form__input"
          >
            {Object.entries(REPORT_REASON_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Additional details (optional)..."
            maxLength={1000}
            rows={2}
            className="form__input"
          />
          <div className="inline-form__actions">
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="btn btn--danger btn--sm"
            >
              {pending ? "Submitting..." : "Submit report"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="btn btn--outline btn--sm"
            >
              Cancel
            </button>
          </div>
          {result && <p className="form__error">{result}</p>}
        </div>
      )}
    </>
  );
}
