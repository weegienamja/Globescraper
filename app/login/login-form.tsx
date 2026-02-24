"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#f5f5f5",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 32,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 24, textAlign: "center" }}>
          Sign In
        </h1>

        {error && (
          <p
            style={{
              color: "#dc2626",
              fontSize: 14,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 16,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 24 }}>
          <span style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 16,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 0",
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            background: loading ? "#9ca3af" : "#2563eb",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
