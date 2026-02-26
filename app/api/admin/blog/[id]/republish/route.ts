import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

/**
 * POST /api/admin/blog/[id]/republish
 * Create a revision and republish with updated content.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      metaTitle,
      metaDescription,
      markdown,
    } = body;

    if (!title || !metaTitle || !metaDescription || !markdown) {
      return NextResponse.json(
        { error: "title, metaTitle, metaDescription, and markdown are required." },
        { status: 400 }
      );
    }

    // Create a revision of the CURRENT state before overwriting
    await prisma.blogRevision.create({
      data: {
        postId: post.id,
        revisionNumber: post.revisionNumber,
        title: post.title,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
        slug: post.slug,
        markdown: post.markdown,
        html: post.html,
        createdByUserId: session.user.id,
      },
    });

    // Update the published post
    const newRevisionNumber = post.revisionNumber + 1;
    const contentHash = crypto.createHash("sha256").update(markdown).digest("hex");

    const updated = await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: {
        title,
        metaTitle,
        metaDescription,
        markdown,
        status: "PUBLISHED",
        publishedAt: post.publishedAt || new Date(),
        revisionNumber: newRevisionNumber,
        updatedByUserId: session.user.id,
        contentHash,
      },
    });

    // Revalidate caches
    revalidatePath(`/${post.slug}`);
    revalidatePath("/blog");

    return NextResponse.json({
      success: true,
      revisionNumber: newRevisionNumber,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[Republish] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Republish failed." },
      { status: 500 }
    );
  }
}
