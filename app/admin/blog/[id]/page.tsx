import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminBlogPostClient from "./admin-blog-post-client";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function AdminBlogPostPage({ params }: Props) {
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

  if (!post) notFound();

  // Fetch all published posts for internal link recommendations
  const allPublished = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED", id: { not: post.id } },
    select: { slug: true, title: true, targetKeyword: true, city: true },
  });

  return (
    <AdminBlogPostClient
      post={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        city: post.city,
        topic: post.topic,
        audience: post.audience,
        targetKeyword: post.targetKeyword,
        secondaryKeywords: post.secondaryKeywords,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
        markdown: post.markdown,
        status: post.status,
        confidence: post.confidence,
        heroImageUrl: post.heroImageUrl,
        ogImageUrl: post.ogImageUrl,
        canonicalUrl: post.canonicalUrl,
        revisionNumber: post.revisionNumber,
        lastSeoScore: post.lastSeoScore,
        lastSeoCheckedAt: post.lastSeoCheckedAt?.toISOString() ?? null,
        seoIssuesJson: post.seoIssuesJson as Record<string, unknown> | null,
        schemaJson: post.schemaJson as Record<string, unknown> | null,
        contentHash: post.contentHash,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        sources: post.sources.map((s) => ({
          id: s.id,
          url: s.url,
          title: s.title,
          publisher: s.publisher,
          fetchedAt: s.fetchedAt.toISOString(),
        })),
        images: post.images.map((img) => ({
          id: img.id,
          kind: img.kind,
          altText: img.altText,
          storageUrl: img.storageUrl,
        })),
        run: post.runs[0]
          ? {
              modelUsed: post.runs[0].modelUsed,
              tokenUsage: post.runs[0].tokenUsage,
              status: post.runs[0].status,
            }
          : null,
        revisions: post.revisions.map((r) => ({
          id: r.id,
          revisionNumber: r.revisionNumber,
          title: r.title,
          createdAt: r.createdAt.toISOString(),
        })),
      }}
      allPublished={allPublished.map((p) => ({
        slug: p.slug,
        title: p.title,
        targetKeyword: p.targetKeyword,
        city: p.city,
      }))}
    />
  );
}
