import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { renderRequestSchema } from "@/lib/email/ai/schemas";
import { renderEmail } from "@/lib/email/render/renderEmail";
import { renderTextVersion } from "@/lib/email/render/renderTextVersion";
import type { Block } from "@/lib/email/blocks/index";

/**
 * POST /api/admin/email/templates/render
 * Render a selected option into final HTML + plain text.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const validated = renderRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid render request.", details: validated.error.flatten() },
        { status: 400 },
      );
    }

    const { selectedOption, links, year } = validated.data;

    const blocks: Block[] = selectedOption.blocks.map((b) => ({
      type: b.type as Block["type"],
      fields: b.fields as Record<string, unknown>,
    }));

    const html = renderEmail({
      blocks,
      subject: selectedOption.optimizedSubject,
      previewText: selectedOption.optimizedPreviewText,
      links,
      year,
    });

    const textVersion = renderTextVersion({
      blocks,
      subject: selectedOption.optimizedSubject,
      previewText: selectedOption.optimizedPreviewText,
      links,
      year,
    });

    return NextResponse.json({
      ok: true,
      html,
      textVersion,
      subject: selectedOption.optimizedSubject,
      previewText: selectedOption.optimizedPreviewText,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
