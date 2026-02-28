import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/blog/by-slug/[slug]
 * Returns admin toolbar + hero editor data for a published AI post.
 * Used by client-side admin components to avoid server-side auth()
 * in the blog post render path (which would kill ISR caching).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    await requireAdmin();

    const post = await prisma.generatedArticleDraft.findFirst({
      where: { slug: params.slug, status: "PUBLISHED" },
      select: {
        id: true,
        lastSeoScore: true,
        confidence: true,
        revisionNumber: true,
        targetKeyword: true,
        heroImageUrl: true,
        markdown: true,
        imagesJson: true,
      },
    });

    if (!post) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 },
    );
  }
}
