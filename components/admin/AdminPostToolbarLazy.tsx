"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AdminPostToolbarClient = dynamic(
  () => import("./AdminPostToolbarClient"),
  { ssr: false },
);

interface AdminData {
  id: string;
  seoScore: number | null;
  confidence: string;
  revisionNumber: number;
  targetKeyword: string | null;
}

interface Props {
  slug: string;
  isAiPost: boolean;
}

/**
 * Client-side wrapper that replaces the server-side AdminPostToolbar.
 * Uses useSession() instead of server auth() so the [slug] page
 * can be ISR-cached. Admin toolbar loads client-side after hydration.
 */
export default function AdminPostToolbarLazy({ slug, isAiPost }: Props) {
  const { data: session, status } = useSession();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isAdmin =
    status === "authenticated" && session?.user?.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin || !isAiPost) {
      setLoaded(true);
      return;
    }
    fetch(`/api/admin/blog/by-slug/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.found && data.post) {
          setAdminData({
            id: data.post.id,
            seoScore: data.post.lastSeoScore,
            confidence: data.post.confidence,
            revisionNumber: data.post.revisionNumber,
            targetKeyword: data.post.targetKeyword,
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [isAdmin, isAiPost, slug]);

  if (!isAdmin || !loaded) return null;

  return (
    <AdminPostToolbarClient
      slug={slug}
      isAiPost={isAiPost}
      adminData={adminData}
    />
  );
}
