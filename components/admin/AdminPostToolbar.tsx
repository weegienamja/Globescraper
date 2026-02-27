import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminPostToolbarClient from "./AdminPostToolbarClient";

interface Props {
  slug: string;
  isAiPost: boolean;
}

/**
 * Server component that gates admin-only blog tools behind an auth check.
 * Returns null for non‑admin users so zero admin UI code is sent to the
 * browser — the client component JS chunk is never even downloaded.
 */
export default async function AdminPostToolbar({ slug, isAiPost }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }

  let adminData: {
    id: string;
    seoScore: number | null;
    confidence: string;
    revisionNumber: number;
    targetKeyword: string | null;
  } | null = null;

  if (isAiPost) {
    const post = await prisma.generatedArticleDraft.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        id: true,
        lastSeoScore: true,
        confidence: true,
        revisionNumber: true,
        targetKeyword: true,
      },
    });
    if (post) {
      adminData = {
        id: post.id,
        seoScore: post.lastSeoScore,
        confidence: post.confidence,
        revisionNumber: post.revisionNumber,
        targetKeyword: post.targetKeyword,
      };
    }
  }

  return (
    <AdminPostToolbarClient
      slug={slug}
      isAiPost={isAiPost}
      adminData={adminData}
    />
  );
}
