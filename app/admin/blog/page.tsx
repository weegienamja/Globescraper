import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  await requireAdmin();

  const posts = await prisma.generatedArticleDraft.findMany({
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
        <h1 className="cgen__title">Published Blog Posts</h1>
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

      {posts.length === 0 ? (
        <div className="cgen__empty">
          <p className="cgen__empty-title">No published posts</p>
          <p className="cgen__empty-text">
            Publish a draft to see it here.
          </p>
        </div>
      ) : (
        <div className="cgen__drafts-grid">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/admin/blog/${post.id}`}
              className="cgen__draft-card"
            >
              <div className="cgen__draft-card-header">
                <span className="cgen__badge cgen__badge--published">
                  PUBLISHED
                </span>
                {post.lastSeoScore !== null && (
                  <span
                    className={`cgen__badge ${
                      post.lastSeoScore >= 80
                        ? "cgen__badge--published"
                        : post.lastSeoScore >= 50
                        ? "cgen__badge--low"
                        : "cgen__badge--error"
                    }`}
                  >
                    SEO: {post.lastSeoScore}
                  </span>
                )}
                {post.confidence === "LOW" && (
                  <span className="cgen__badge cgen__badge--low">LOW</span>
                )}
              </div>
              <h3 className="cgen__draft-card-title">{post.title}</h3>
              <div className="cgen__draft-card-meta">
                <span>{post.city}</span>
                <span>{post.topic}</span>
                <span>Rev {post.revisionNumber}</span>
              </div>
              <div className="cgen__draft-card-footer">
                <span>Published: {fmtDate(post.publishedAt || post.createdAt)}</span>
                <span>
                  {post._count.sources} sources, {post._count.images} images
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
