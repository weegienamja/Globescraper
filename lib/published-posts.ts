import { prisma } from "@/lib/prisma";

export interface PublishedAiPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  modifiedDate: string;
  author: string;
  markdown: string;
  city: string;
  isAiGenerated: true;
}

/**
 * Fetch all published AI-generated articles from the database.
 * Returns them in the same shape as static PostMeta (plus markdown body).
 */
export async function getPublishedAiPosts(): Promise<PublishedAiPost[]> {
  const drafts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      metaDescription: true,
      markdown: true,
      city: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return drafts.map((d) => ({
    slug: d.slug,
    title: d.title,
    description: d.metaDescription,
    date: d.createdAt.toISOString().split("T")[0],
    modifiedDate: d.updatedAt.toISOString().split("T")[0],
    author: "GlobeScraper",
    markdown: d.markdown,
    city: d.city,
    isAiGenerated: true as const,
  }));
}

/**
 * Fetch a single published AI article by slug.
 */
export async function getPublishedAiPost(slug: string): Promise<PublishedAiPost | null> {
  const draft = await prisma.generatedArticleDraft.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      markdown: true,
      city: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!draft) return null;

  return {
    slug: draft.slug,
    title: draft.title,
    description: draft.metaDescription,
    date: draft.createdAt.toISOString().split("T")[0],
    modifiedDate: draft.updatedAt.toISOString().split("T")[0],
    author: "GlobeScraper",
    markdown: draft.markdown,
    city: draft.city,
    isAiGenerated: true as const,
  };
}
