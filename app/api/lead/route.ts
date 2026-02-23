import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ALLOWED_ORIGINS = [
  "https://globescraper.com",
  "https://www.globescraper.com",
];

// Simple in-memory rate limiter (resets on cold start; use Upstash Redis for production-grade)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 }); // 1-min window
    return false;
  }
  entry.count++;
  return entry.count > 5; // max 5 submissions per minute per IP
}

const LeadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email(),
  message: z.string().trim().max(5000).optional(),
  source: z.string().trim().max(120).optional(),
});

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: Request) {
  // --- CORS origin check ---
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  // --- Rate limiting ---
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return new Response("Too many requests", { status: 429 });
  }

  const json = await req.json().catch(() => null);
  if (!json) return new Response("Bad JSON", { status: 400 });

  const parsed = LeadSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        message: parsed.data.message,
        source: parsed.data.source,
      },
    });

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }

    return new Response(JSON.stringify({ ok: true, id: lead.id }), {
      headers,
    });
  } catch (err) {
    // Log error server-side for debugging, but do not leak details to client
    console.error("[API /lead] Prisma error:", err);
    return new Response("Database error", { status: 500 });
  }
}
