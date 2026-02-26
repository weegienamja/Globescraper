import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/content-generator/drafts/[id]
 * Update a draft's editable fields.
 */
export async function PATCH(
  req: NextRequest,
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

    const body = await req.json();
    const { title, metaTitle, metaDescription, markdown } = body;

    const updateData: Record<string, string> = {};
    if (typeof title === "string") updateData.title = title;
    if (typeof metaTitle === "string") updateData.metaTitle = metaTitle;
    if (typeof metaDescription === "string") updateData.metaDescription = metaDescription;
    if (typeof markdown === "string") updateData.markdown = markdown;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const updated = await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error("[Draft Update] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/content-generator/drafts/[id]
 * Fetch a single draft.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const draft = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      include: {
        sources: true,
        runs: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error("[Draft Fetch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed." },
      { status: 500 }
    );
  }
}
