import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DraftEditorClient from "./draft-editor-client";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function DraftDetailPage({ params }: Props) {
  await requireAdmin();

  const draft = await prisma.generatedArticleDraft.findUnique({
    where: { id: params.id },
    include: {
      sources: {
        orderBy: { fetchedAt: "desc" },
      },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!draft) {
    notFound();
  }

  return (
    <DraftEditorClient
      draft={{
        id: draft.id,
        title: draft.title,
        slug: draft.slug,
        city: draft.city,
        topic: draft.topic,
        audience: draft.audience,
        targetKeyword: draft.targetKeyword,
        secondaryKeywords: draft.secondaryKeywords,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        markdown: draft.markdown,
        status: draft.status,
        confidence: draft.confidence,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
        sources: draft.sources.map((s) => ({
          id: s.id,
          url: s.url,
          title: s.title,
          publisher: s.publisher,
          fetchedAt: s.fetchedAt.toISOString(),
        })),
        run: draft.runs[0]
          ? {
              modelUsed: draft.runs[0].modelUsed,
              tokenUsage: draft.runs[0].tokenUsage,
              status: draft.runs[0].status,
            }
          : null,
      }}
    />
  );
}
