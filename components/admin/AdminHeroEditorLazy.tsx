"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AdminImageManager = dynamic(() => import("./AdminImageManager"), {
  ssr: false,
});

interface ImageSlot {
  slot: string;
  label: string;
  imageUrl: string;
  altText: string;
  caption: string;
}

interface Props {
  slug: string;
  isAiPost: boolean;
  heroSrc: string;
}

interface ImgRecord {
  kind?: string;
  sectionHeading?: string;
  storageUrl?: string;
  altText?: string;
  caption?: string;
}

/**
 * Client-side wrapper that replaces the server-side AdminHeroEditorGate.
 * Uses useSession() instead of server auth() so the [slug] page
 * can be ISR-cached. Image manager loads client-side after hydration.
 */
export default function AdminHeroEditorLazy({
  slug,
  isAiPost,
  heroSrc,
}: Props) {
  const { data: session, status } = useSession();
  const [postId, setPostId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageSlot[]>([]);
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
          setPostId(data.post.id);
          setImages(
            buildImageSlots(
              data.post.markdown,
              data.post.imagesJson,
              data.post.heroImageUrl,
              heroSrc,
            ),
          );
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [isAdmin, isAiPost, slug, heroSrc]);

  if (!isAdmin || !isAiPost || !loaded || !postId) return null;

  return <AdminImageManager postId={postId} images={images} />;
}

/* ── Helpers (ported from server AdminHeroEditorGate) ── */

function extractH2Headings(markdown: string): string[] {
  const headings: string[] = [];
  const pattern = /^## (.+)$/gm;
  let m;
  while ((m = pattern.exec(markdown)) !== null) {
    headings.push(m[1].trim());
  }
  return headings;
}

function parseImagesJson(raw: unknown): ImgRecord[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ImgRecord[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ImgRecord[];
    } catch {
      return [];
    }
  }
  return [];
}

function extractMarkdownImages(
  markdown: string,
  headings: string[],
): Map<string, { url: string; alt: string; caption: string }> {
  const result = new Map<
    string,
    { url: string; alt: string; caption: string }
  >();

  const heroMatch = markdown.match(/^# .+\n\n!\[([^\]]*)\]\(([^)]+)\)/m);
  if (heroMatch) {
    result.set("hero", { url: heroMatch[2], alt: heroMatch[1], caption: "" });
  }

  for (const h of headings) {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = new RegExp(
      `^## ${escaped}[^\\n]*\\n\\n!\\[([^\\]]*)\\]\\(([^)]+)\\)(?:\\n\\*([^*]+)\\*)?`,
      "m",
    );
    const m = markdown.match(pat);
    if (m) {
      result.set(h, { url: m[2], alt: m[1], caption: m[3] || "" });
    }
  }

  return result;
}

function buildImageSlots(
  markdown: string,
  imagesJson: unknown,
  heroImageUrl: string | null,
  heroSrc: string,
): ImageSlot[] {
  const headings = extractH2Headings(markdown);
  const imagesArr = parseImagesJson(imagesJson);

  const lookup = new Map<
    string,
    { url: string; alt: string; caption: string }
  >();
  for (const img of imagesArr) {
    const key = img.kind === "HERO" ? "hero" : img.sectionHeading || "";
    lookup.set(key, {
      url: img.storageUrl || "",
      alt: img.altText || "",
      caption: img.caption || "",
    });
  }

  const mdImages = extractMarkdownImages(markdown, headings);
  for (const [key, val] of mdImages) {
    if (!lookup.has(key)) lookup.set(key, val);
    else {
      const existing = lookup.get(key)!;
      lookup.set(key, {
        url: existing.url || val.url,
        alt: val.alt || existing.alt,
        caption: val.caption || existing.caption,
      });
    }
  }

  return [
    {
      slot: "hero",
      label: "Hero Image",
      imageUrl:
        heroImageUrl || heroSrc || lookup.get("hero")?.url || "",
      altText: lookup.get("hero")?.alt || "",
      caption: lookup.get("hero")?.caption || "",
    },
    ...headings.map((h) => ({
      slot: h,
      label: h,
      imageUrl: lookup.get(h)?.url || "",
      altText: lookup.get(h)?.alt || "",
      caption: lookup.get(h)?.caption || "",
    })),
  ];
}
