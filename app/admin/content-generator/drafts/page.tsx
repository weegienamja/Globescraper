import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  await requireAdmin();

  const drafts = await prisma.generatedArticleDraft.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      topic: true,
      audience: true,
      status: true,
      confidence: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sources: true } },
    },
  });

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="cgen">
      <div className="cgen__header">
        <h1 className="cgen__title">Article Drafts</h1>
        <div className="cgen__nav">
          <Link href="/admin/content-generator" className="cgen__back-link">
            Back to Generator
          </Link>
          <Link href="/admin" className="btn btn--secondary">
            Admin Dashboard
          </Link>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="cgen__empty">
          <div className="cgen__empty-icon">📝</div>
          <p className="cgen__empty-title">No drafts yet</p>
          <p className="cgen__empty-text">
            Generate your first article to see it here.
          </p>
          <Link href="/admin/content-generator" className="btn btn--primary">
            Generate Article
          </Link>
        </div>
      ) : (
        <div className="cgen__drafts-grid">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/admin/content-generator/drafts/${draft.id}`}
              className="cgen__draft-card"
            >
              <div className="cgen__draft-card-header">
                <span
                  className={`cgen__badge cgen__badge--${draft.status === "PUBLISHED" ? "published" : "draft"}`}
                >
                  {draft.status}
                </span>
                {draft.confidence === "LOW" && (
                  <span className="cgen__badge cgen__badge--low">LOW</span>
                )}
              </div>
              <h3 className="cgen__draft-card-title">{draft.title}</h3>
              <div className="cgen__draft-card-meta">
                <span>{draft.city}</span>
                <span>{draft.topic}</span>
                <span>{draft.audience}</span>
              </div>
              <div className="cgen__draft-card-footer">
                <span>{fmtDate(draft.createdAt)}</span>
                <span>{draft._count.sources} sources</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
