import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminHeroEditor from "./AdminHeroEditor";

interface Props {
  slug: string;
  isAiPost: boolean;
  heroSrc: string;
}

/**
 * Server component that only renders the hero editor for admin users
 * viewing AI-generated posts. Returns null for everyone else.
 */
export default async function AdminHeroEditorGate({
  slug,
  isAiPost,
  heroSrc,
}: Props) {
  if (!isAiPost) return null;

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;

  const post = await prisma.generatedArticleDraft.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true, heroImageUrl: true },
  });
  if (!post) return null;

  return (
    <AdminHeroEditor
      postId={post.id}
      currentHeroUrl={post.heroImageUrl || heroSrc}
    />
  );
}
