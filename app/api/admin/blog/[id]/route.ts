import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

/**
 * GET /api/admin/blog/[id]
 * Fetch a published post with all associated data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      include: {
        sources: { orderBy: { fetchedAt: "desc" } },
        images: { orderBy: { createdAt: "asc" } },
        runs: { orderBy: { startedAt: "desc" }, take: 1 },
        revisions: { orderBy: { revisionNumber: "desc" }, take: 10 },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("[Blog Post Fetch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/blog/[id]
 * Update post fields (save draft changes without publishing).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const body = await req.json();
    const { title, metaTitle, metaDescription, markdown } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof title === "string") updateData.title = title;
    if (typeof metaTitle === "string") updateData.metaTitle = metaTitle;
    if (typeof metaDescription === "string") updateData.metaDescription = metaDescription;
    if (typeof markdown === "string") {
      updateData.markdown = markdown;
      updateData.contentHash = crypto.createHash("sha256").update(markdown).digest("hex");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const updated = await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error("[Blog Post Update] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/blog/[id]
 * Delete the post and all associated data.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const confirmSlug = body.confirmSlug as string;

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    if (confirmSlug !== post.slug) {
      return NextResponse.json(
        { error: "Slug confirmation does not match. Deletion cancelled." },
        { status: 400 }
      );
    }

    // Cascade delete handles revisions, sources, images, runs
    await prisma.generatedArticleDraft.delete({
      where: { id: params.id },
    });

    // Revalidate paths
    revalidatePath(`/${post.slug}`);
    revalidatePath("/blog");

    return NextResponse.json({ success: true, deleted: post.slug });
  } catch (error) {
    console.error("[Blog Post Delete] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed." },
      { status: 500 }
    );
  }
}
