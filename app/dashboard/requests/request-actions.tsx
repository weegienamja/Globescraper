"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { respondToConnection } from "@/app/community/actions";

export function RequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handle(action: "ACCEPTED" | "DECLINED" | "BLOCKED") {
    startTransition(async () => {
      await respondToConnection(requestId, action);
      router.refresh();
    });
  }

  return (
    <div className="request-card__actions">
      <button
        onClick={() => handle("ACCEPTED")}
        disabled={pending}
        className="btn btn--primary btn--sm"
      >
        Accept
      </button>
      <button
        onClick={() => handle("DECLINED")}
        disabled={pending}
        className="btn btn--outline btn--sm"
      >
        Decline
      </button>
      <button
        onClick={() => handle("BLOCKED")}
        disabled={pending}
        className="btn btn--danger btn--sm"
      >
        Block
      </button>
    </div>
  );
}

export function RemoveConnectionButton({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function handleRemove() {
    startTransition(async () => {
      const res = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="request-card__actions">
        <span className="request-card__confirm-text">Remove this connection?</span>
        <button
          onClick={handleRemove}
          disabled={pending}
          className="btn btn--danger btn--sm"
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="btn btn--outline btn--sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="btn btn--ghost btn--sm btn--danger-text"
    >
      Remove
    </button>
  );
}

export function MessageButton({ userId }: { userId: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/dashboard/messages?to=${userId}`)}
      className="btn btn--outline btn--sm"
    >
      Message
    </button>
  );
}
