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
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred. Please try again later or check server logs.</p>
      <button onClick={() => reset()} style={{ padding: "8px 12px" }}>
        Try again
      </button>
    </div>
  );
}
