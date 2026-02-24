import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Login rate limiter — 5 attempts per 15-minute sliding window per IP.
 */

let _loginInstance: Ratelimit | null | undefined;

export function getLoginRatelimit(): Ratelimit | null {
  if (_loginInstance !== undefined) return _loginInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _loginInstance = null;
    return null;
  }

  _loginInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:login",
    analytics: true,
  });

  return _loginInstance;
}

/**
 * Connection request rate limiter — 10 requests per 24-hour sliding window per user.
 */

let _connectionInstance: Ratelimit | null | undefined;

export function getConnectionRatelimit(): Ratelimit | null {
  if (_connectionInstance !== undefined) return _connectionInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _connectionInstance = null;
    return null;
  }

  _connectionInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    prefix: "ratelimit:connect",
    analytics: true,
  });

  return _connectionInstance;
}

/**
 * DM rate limiter — 30 messages per 1-minute sliding window per user.
 */

let _dmInstance: Ratelimit | null | undefined;

export function getDmRatelimit(): Ratelimit | null {
  if (_dmInstance !== undefined) return _dmInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _dmInstance = null;
    return null;
  }

  _dmInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:dm",
    analytics: true,
  });

  return _dmInstance;
}
