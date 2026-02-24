"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{
        padding: "6px 14px",
        fontSize: 14,
        background: "#ef4444",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      Sign Out
    </button>
  );
}
