"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SignupForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    const email = (fd.get("email") as string).trim();
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    // 1. Create account
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    // 2. Auto sign-in
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // Account created but sign-in failed — send to login
      router.push("/login");
    } else {
      // Redirect to profile completion
      router.push("/create-profile");
      router.refresh();
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">
          Join GlobeScraper to find ESL teaching positions in Southeast Asia.
        </p>

        {error && <p className="auth-error">{error}</p>}

        <label className="auth-label">
          <span className="auth-label-text">Full Name</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            className="auth-input"
          />
        </label>

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
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
          />
        </label>

        <label className="auth-label">
          <span className="auth-label-text">Confirm Password</span>
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
          />
        </label>

        <button type="submit" disabled={loading} className="auth-button">
          {loading ? "Creating account…" : "Sign Up"}
        </button>

        <p className="auth-footer">
          Already have an account?{" "}
          <a href="/login" className="auth-link">
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
