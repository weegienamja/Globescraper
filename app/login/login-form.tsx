"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

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
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1 className="auth-title">Sign In</h1>

        {error && <p className="auth-error">{error}</p>}

        <label className="auth-label">
          <span className="auth-label-text">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="auth-input"
          />
        </label>

        <label className="auth-label">
          <span className="auth-label-text">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="auth-input"
          />
        </label>

        <button type="submit" disabled={loading} className="auth-button">
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <p className="auth-footer">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="auth-link">
            Sign up
          </a>
        </p>
      </form>
    </div>
  );
}
