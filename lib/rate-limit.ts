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

/**
 * AI content generation rate limiter — 10 generations per 24-hour sliding window per admin.
 */

let _contentGenInstance: Ratelimit | null | undefined;

export function getContentGenRatelimit(): Ratelimit | null {
  if (_contentGenInstance !== undefined) return _contentGenInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _contentGenInstance = null;
    return null;
  }

  _contentGenInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    prefix: "ratelimit:content-gen",
    analytics: true,
  });

  return _contentGenInstance;
}

/**
 * SEO check rate limiter — 20 checks per 24-hour sliding window per admin.
 */

let _seoCheckInstance: Ratelimit | null | undefined;

export function getSeoCheckRatelimit(): Ratelimit | null {
  if (_seoCheckInstance !== undefined) return _seoCheckInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _seoCheckInstance = null;
    return null;
  }

  _seoCheckInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, "24 h"),
    prefix: "ratelimit:seo-check",
    analytics: true,
  });

  return _seoCheckInstance;
}

/**
 * SEO fix rate limiter — 10 fixes per 24-hour sliding window per admin.
 */

let _seoFixInstance: Ratelimit | null | undefined;

export function getSeoFixRatelimit(): Ratelimit | null {
  if (_seoFixInstance !== undefined) return _seoFixInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _seoFixInstance = null;
    return null;
  }

  _seoFixInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    prefix: "ratelimit:seo-fix",
    analytics: true,
  });

  return _seoFixInstance;
}

/**
 * News topic search rate limiter — 50 searches per 24-hour sliding window per admin.
 */

let _newsSearchInstance: Ratelimit | null | undefined;

export function getNewsSearchRatelimit(): Ratelimit | null {
  if (_newsSearchInstance !== undefined) return _newsSearchInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _newsSearchInstance = null;
    return null;
  }

  _newsSearchInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(50, "24 h"),
    prefix: "ratelimit:news-search",
    analytics: true,
  });

  return _newsSearchInstance;
}

/**
 * News draft generation rate limiter — 10 generations per 24-hour sliding window per admin.
 */

let _newsGenInstance: Ratelimit | null | undefined;

export function getNewsGenRatelimit(): Ratelimit | null {
  if (_newsGenInstance !== undefined) return _newsGenInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _newsGenInstance = null;
    return null;
  }

  _newsGenInstance = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    prefix: "ratelimit:news-gen",
    analytics: true,
  });

  return _newsGenInstance;
}
