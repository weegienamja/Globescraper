import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/content-generator/drafts/[id]/publish
 * Publish a draft article.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const draft = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    if (draft.status === "PUBLISHED") {
      return NextResponse.json({ error: "Already published." }, { status: 400 });
    }

    await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: { status: "PUBLISHED" },
    });

    return NextResponse.json({ success: true, status: "PUBLISHED" });
  } catch (error) {
    console.error("[Draft Publish] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed." },
      { status: 500 }
    );
  }
}
