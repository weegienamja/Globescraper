import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Login rate limiter — 5 attempts per 15-minute sliding window per IP.
 *
 * Uses Upstash Redis in production (set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN in env vars).
 *
 * Returns `null` when Upstash is not configured so callers can
 * gracefully skip rate limiting during local development.
 *
 * Edge-runtime compatible (used in middleware.ts).
 */

let _instance: Ratelimit | null | undefined;

export function getLoginRatelimit(): Ratelimit | null {
  // Already initialised (or confirmed unavailable)
  if (_instance !== undefined) return _instance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _instance = null; // mark as unavailable — don't check again
    return null;
  }

  _instance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:login",
    analytics: true,
  });

  return _instance;
}
