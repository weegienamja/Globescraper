import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLoginRatelimit } from "@/lib/rate-limit";

/**
 * Lightweight middleware:
 *
 * 1) Guards /admin routes — checks for session-token cookie presence.
 *    Full session + role validation happens server-side via `requireAdmin()`.
 *
 * 2) Rate-limits POST /api/auth/callback/credentials (login attempts).
 *    Uses Upstash Redis when configured; skips in local dev otherwise.
 *
 * Edge-runtime safe — no Prisma, no argon2.
 */

const SESSION_COOKIE = "authjs.session-token";
const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token";

const CREDENTIALS_CALLBACK = "/api/auth/callback/credentials";

export async function middleware(req: NextRequest) {
  // ── Rate-limit credential login attempts ──────────────────────
  if (
    req.method === "POST" &&
    req.nextUrl.pathname === CREDENTIALS_CALLBACK
  ) {
    const limiter = getLoginRatelimit();
    if (limiter) {
      // Prefer req.ip (set by Vercel, non-spoofable), then x-forwarded-for,
      // then a dev fallback. Use || (not ??) so empty strings are skipped.
      const ip =
        req.ip
        || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || "127.0.0.1";

      const { success, reset } = await limiter.limit(ip);

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "Too many login attempts. Please try again later." },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          },
        );
      }
    }
  }

  // ── Auth cookie guard ──────────────────────────────────────
  const pathname = req.nextUrl.pathname;
  const protectedPaths = ["/admin", "/dashboard", "/create-profile", "/tools"];
  // /community and /meetups root pages show invite content for logged-out users;
  // all sub-routes (edit-profile, [userId], new, [id]) remain protected.
  const publicExactPages = ["/community", "/meetups"];
  const isProtected =
    protectedPaths.some((p) => pathname.startsWith(p)) ||
    ((pathname.startsWith("/community") || pathname.startsWith("/meetups")) &&
     !publicExactPages.includes(pathname));

  if (isProtected) {
    const hasSession =
      req.cookies.has(SESSION_COOKIE) ||
      req.cookies.has(SECURE_SESSION_COOKIE);

    if (!hasSession) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/create-profile/:path*",
    "/tools/:path*",
    "/community",
    "/community/:path*",
    "/meetups",
    "/meetups/:path*",
    "/api/auth/callback/credentials",
  ],
};
