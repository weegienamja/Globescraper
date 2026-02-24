"use client";

import { useTransition } from "react";
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
