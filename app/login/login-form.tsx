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
      <form onSubmit={handleSubmit} action="/login" method="POST" className="auth-card">
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

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="auth-google-button"
          onClick={() => signIn("google", { callbackUrl })}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
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
