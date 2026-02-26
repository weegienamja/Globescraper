/**
 * Resend email client.
 *
 * Configuration:
 *   1. Add RESEND_API_KEY to .env.local for local development
 *   2. Add RESEND_API_KEY to Vercel Environment Variables for production
 *
 * At runtime, if the key is missing the helper throws a clear admin error.
 */

import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend {
  if (_client) return _client;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Resend API key not configured.");
  }

  _client = new Resend(key);
  return _client;
}
