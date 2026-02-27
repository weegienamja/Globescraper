import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPostsMeta } from "@/lib/content";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Unified card shape that works for both AI and static posts. */
type UnifiedPost = {
  key: string;
  href: string;
  title: string;
  kind: "ai" | "static";
  city?: string;
  topic?: string;
  author?: string;
  status: string;
  confidence?: string;
  seoScore: number | null;
  revisionNumber?: number;
  date: Date;
  sourceCount?: number;
  imageCount?: number;
};

export default async function AdminBlogPage() {
  await requireAdmin();

  /* ── AI-generated posts from the database ── */
  const aiPosts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      topic: true,
      status: true,
      confidence: true,
      lastSeoScore: true,
      lastSeoCheckedAt: true,
      revisionNumber: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sources: true, images: true, revisions: true } },
    },
  });

  /* ── Static posts from content/posts.json ── */
  const staticPosts = getPostsMeta();

  /* ── Merge into a unified list, deduplicated by slug, newest first ── */
  const aiSlugs = new Set(aiPosts.map((p) => p.slug));

  const unified: UnifiedPost[] = [
    ...aiPosts.map((p) => ({
      key: p.id,
      href: `/admin/blog/${p.id}`,
      title: p.title,
      kind: "ai" as const,
      city: p.city,
      topic: p.topic,
      status: p.status,
      confidence: p.confidence,
      seoScore: p.lastSeoScore,
      revisionNumber: p.revisionNumber,
      date: p.publishedAt || p.createdAt,
      sourceCount: p._count.sources,
      imageCount: p._count.images,
    })),
    ...staticPosts
      .filter((p) => !aiSlugs.has(p.slug))
      .map((p) => ({
        key: `static-${p.slug}`,
        href: `/${p.slug}`,
        title: p.title.replace(" | GlobeScraper", ""),
        kind: "static" as const,
        author: p.author,
        status: "PUBLISHED",
        seoScore: null,
        date: new Date(p.modifiedDate || p.date),
      })),
  ];

  unified.sort((a, b) => b.date.getTime() - a.date.getTime());

  const fmtDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "N/A";

  return (
    <div className="cgen">
      <div className="cgen__header">
        <h1 className="cgen__title">All Blog Posts</h1>
        <div className="cgen__nav">
          <Link href="/admin" className="cgen__back-link">
            Back to Admin
          </Link>
          <Link href="/admin/content-generator" className="btn btn--secondary">
            Generator
          </Link>
          <Link href="/admin/content-generator/drafts" className="btn btn--secondary">
            Drafts
          </Link>
        </div>
      </div>

      {unified.length === 0 ? (
        <div className="cgen__empty">
          <p className="cgen__empty-title">No published posts</p>
          <p className="cgen__empty-text">
            Publish a draft to see it here.
          </p>
        </div>
      ) : (
        <div className="cgen__drafts-grid">
          {unified.map((post) => (
            <Link
              key={post.key}
              href={post.href}
              className="cgen__draft-card"
              {...(post.kind === "static" ? { target: "_blank" } : {})}
            >
              <div className="cgen__draft-card-header">
                <span className="cgen__badge cgen__badge--published">
                  PUBLISHED
                </span>
                {post.kind === "static" && (
                  <span className="cgen__badge cgen__badge--static">
                    STATIC
                  </span>
                )}
                {post.kind === "ai" && post.seoScore !== null && (
                  <span
                    className={`cgen__badge ${
                      post.seoScore >= 80
                        ? "cgen__badge--published"
                        : post.seoScore >= 50
                        ? "cgen__badge--low"
                        : "cgen__badge--error"
                    }`}
                  >
                    SEO: {post.seoScore}
                  </span>
                )}
                {post.confidence === "LOW" && (
                  <span className="cgen__badge cgen__badge--low">LOW</span>
                )}
              </div>
              <h3 className="cgen__draft-card-title">{post.title}</h3>
              <div className="cgen__draft-card-meta">
                {post.city && <span>{post.city}</span>}
                {post.topic && <span>{post.topic}</span>}
                {post.author && <span>By {post.author}</span>}
                {post.revisionNumber !== undefined && (
                  <span>Rev {post.revisionNumber}</span>
                )}
              </div>
              <div className="cgen__draft-card-footer">
                <span>{post.kind === "ai" ? "Published" : "Updated"}: {fmtDate(post.date)}</span>
                {post.kind === "ai" && (
                  <span>
                    {post.sourceCount} sources, {post.imageCount} images
                  </span>
                )}
                {post.kind === "static" && (
                  <span>Static HTML post</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
