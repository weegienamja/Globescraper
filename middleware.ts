import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseBasicAuthFromEnv(): { user: string; pass: string } | null {
  // Preferred: separate vars
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (user && pass) return { user, pass };

  // Backward compatible: single var "user:pass"
  const combined = process.env.BASIC_AUTH;
  if (combined && combined.includes(":")) {
    const idx = combined.indexOf(":");
    const u = combined.slice(0, idx);
    const p = combined.slice(idx + 1);
    if (u && p) return { user: u, pass: p };
  }
  return null;
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

export function middleware(req: NextRequest) {
  // DEBUG: Disable admin auth temporarily
  // ---
  // if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  // const creds = parseBasicAuthFromEnv();
  // if (!creds) {
  //   return new NextResponse(
  //     "Admin auth is misconfigured. Set BASIC_AUTH_USER and BASIC_AUTH_PASS (or BASIC_AUTH as user:pass).",
  //     { status: 500 }
  //   );
  // }
  // const authHeader = req.headers.get("authorization");
  // if (!authHeader?.startsWith("Basic ")) return unauthorized();
  // const base64 = authHeader.slice("Basic ".length);
  // let decoded = "";
  // try {
  //   decoded = Buffer.from(base64, "base64").toString("utf8");
  // } catch {
  //   return unauthorized();
  // }
  // const sep = decoded.indexOf(":");
  // if (sep === -1) return unauthorized();
  // const user = decoded.slice(0, sep);
  // const pass = decoded.slice(sep + 1);
  // if (user !== creds.user || pass !== creds.pass) return unauthorized();
  // return NextResponse.next();
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
