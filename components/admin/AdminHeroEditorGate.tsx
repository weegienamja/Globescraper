import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminImageManager from "./AdminImageManager";

interface Props {
  slug: string;
  isAiPost: boolean;
  heroSrc: string;
}

/**
 * Server component that only renders the image manager for admin users
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
    select: { id: true, heroImageUrl: true, markdown: true, imagesJson: true },
  });
  if (!post) return null;

  /* ── Build image slots from markdown headings ── */
  const headings = extractH2Headings(post.markdown);
  const imagesArr = parseImagesJson(post.imagesJson);

  // Build lookup: sectionHeading|"hero" → {url, alt, caption}
  const lookup = new Map<string, { url: string; alt: string; caption: string }>();
  for (const img of imagesArr) {
    const key = img.kind === "HERO" ? "hero" : (img.sectionHeading || "");
    lookup.set(key, {
      url: img.storageUrl || "",
      alt: img.altText || "",
      caption: img.caption || "",
    });
  }

  // Also extract from markdown directly for more reliable data
  const mdImages = extractMarkdownImages(post.markdown, headings);
  for (const [key, val] of mdImages) {
    if (!lookup.has(key)) lookup.set(key, val);
    else {
      // Prefer markdown source for alt/caption (always latest)
      const existing = lookup.get(key)!;
      lookup.set(key, {
        url: existing.url || val.url,
        alt: val.alt || existing.alt,
        caption: val.caption || existing.caption,
      });
    }
  }

  const slots = [
    {
      slot: "hero",
      label: "Hero Image",
      imageUrl: post.heroImageUrl || heroSrc || lookup.get("hero")?.url || "",
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

  return <AdminImageManager postId={post.id} images={slots} />;
}

/* ── Helpers ──────────────────────────────────────────── */

function extractH2Headings(markdown: string): string[] {
  const headings: string[] = [];
  const pattern = /^## (.+)$/gm;
  let m;
  while ((m = pattern.exec(markdown)) !== null) {
    headings.push(m[1].trim());
  }
  return headings;
}

interface ImgRecord {
  kind?: string;
  sectionHeading?: string;
  storageUrl?: string;
  altText?: string;
  caption?: string;
}

function parseImagesJson(raw: unknown): ImgRecord[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ImgRecord[];
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as ImgRecord[]; } catch { return []; }
  }
  return [];
}

/**
 * Extract image info directly from markdown to catch manual edits
 * that may not be reflected in imagesJson.
 */
function extractMarkdownImages(
  markdown: string,
  headings: string[]
): Map<string, { url: string; alt: string; caption: string }> {
  const result = new Map<string, { url: string; alt: string; caption: string }>();

  // Hero: after H1
  const heroMatch = markdown.match(/^# .+\n\n!\[([^\]]*)\]\(([^)]+)\)/m);
  if (heroMatch) {
    result.set("hero", { url: heroMatch[2], alt: heroMatch[1], caption: "" });
  }

  // Section images
  for (const h of headings) {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = new RegExp(
      `^## ${escaped}[^\\n]*\\n\\n!\\[([^\\]]*)\\]\\(([^)]+)\\)(?:\\n\\*([^*]+)\\*)?`,
      "m"
    );
    const m = markdown.match(pat);
    if (m) {
      result.set(h, { url: m[2], alt: m[1], caption: m[3] || "" });
    }
  }

  return result;
}
