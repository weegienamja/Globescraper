"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendConnectionRequest,
  blockUser,
  unblockUser,
  hideUser,
  unhideUser,
  submitReport,
} from "@/app/community/actions";
import { REPORT_REASON_LABELS } from "@/lib/validations/community";

// ── Connect Button + Modal ───────────────────────────────────

export function ConnectButton({ toUserId }: { toUserId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function handleSend() {
    startTransition(async () => {
      const res = await sendConnectionRequest({ toUserId, message });
      if ("error" in res) {
        setResult(res.error);
      } else {
        setResult("Request sent!");
        setShowForm(false);
        router.refresh();
      }
    });
  }

  if (result === "Request sent!") {
    return <span className="badge badge--ok">✓ Request sent</span>;
  }

  return (
    <>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="btn btn--primary btn--sm"
        >
          Connect
        </button>
      ) : (
        <div className="inline-form">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional intro message (max 300 chars)..."
            maxLength={300}
            rows={2}
            className="form__input"
          />
          <div className="inline-form__actions">
            <button
              onClick={handleSend}
              disabled={pending}
              className="btn btn--primary btn--sm"
            >
              {pending ? "Sending..." : "Send request"}
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

// ── Block Button ─────────────────────────────────────────────

export function BlockButton({
  targetUserId,
  isBlocked,
}: {
  targetUserId: string;
  isBlocked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [blocked, setBlocked] = useState(isBlocked);
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      if (blocked) {
        await unblockUser(targetUserId);
        setBlocked(false);
      } else {
        await blockUser(targetUserId);
        setBlocked(true);
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`btn btn--sm ${blocked ? "btn--outline" : "btn--danger"}`}
    >
      {pending ? "..." : blocked ? "Unblock" : "Block"}
    </button>
  );
}

// ── Hide Button ──────────────────────────────────────────────

export function HideButton({
  targetUserId,
  isHidden,
}: {
  targetUserId: string;
  isHidden: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(isHidden);
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      if (hidden) {
        await unhideUser(targetUserId);
        setHidden(false);
      } else {
        await hideUser(targetUserId);
        setHidden(true);
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className="btn btn--ghost btn--sm"
      title={hidden ? "Unhide this user in community (admin)" : "Hide this user from all community views (admin)"}
    >
      {pending ? "..." : hidden ? "Unhide" : "Hide"}
    </button>
  );
}

// ── Report Button + Modal ────────────────────────────────────

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "USER" | "MEETUP";
  targetId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitReport({
        targetType,
        targetId,
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
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Additional details (optional, max 1000 chars)..."
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
