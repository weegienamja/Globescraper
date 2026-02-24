"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="admin__btn-sm"
      style={{ background: "#ef4444", padding: "8px 16px", fontSize: 14 }}
    >
      Sign Out
    </button>
  );
}
