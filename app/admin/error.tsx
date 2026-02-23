"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/admin error boundary]", error);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Admin crashed</h1>
      <p><b>Message:</b> {error.message}</p>
      {error.digest ? <p><b>Digest:</b> {error.digest}</p> : null}
      <button onClick={() => reset()} style={{ padding: "8px 12px" }}>
        Try again
      </button>
    </div>
  );
}
