import { z } from "zod";
import { prisma } from "@/lib/prisma";

const LeadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email(),
  message: z.string().trim().max(5000).optional(),
  source: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  if (!json) return new Response("Bad JSON", { status: 400 });

  const parsed = LeadSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const lead = await prisma.lead.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
      source: parsed.data.source,
    },
  });

  return new Response(JSON.stringify({ ok: true, id: lead.id }), {
    headers: { "content-type": "application/json" },
  });
}
