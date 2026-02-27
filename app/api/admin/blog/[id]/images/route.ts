import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { generateHybridImages } from "@/lib/ai/imageSearch";
import { callGeminiText } from "@/lib/ai/geminiClient";
import { type ImageSpec } from "@/lib/ai/imageGen";

export const maxDuration = 120;

/** Image extensions we trust even when the server sends wrong content-type */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)(\?|$)/i;

/**
 * Determine the real mime type based on content-type header AND URL extension.
 * Many servers (especially government sites) return text/plain or application/octet-stream for images.
 */
function resolveImageMime(ct: string, url: string): string | null {
  if (ct.startsWith("image/")) return ct;
  // If content-type is wrong but URL ends in an image extension, trust the extension
  if (IMAGE_EXTENSIONS.test(url)) {
    if (/\.jpe?g/i.test(url)) return "image/jpeg";
    if (/\.png/i.test(url)) return "image/png";
    if (/\.webp/i.test(url)) return "image/webp";
    if (/\.gif/i.test(url)) return "image/gif";
    if (/\.avif/i.test(url)) return "image/avif";
    if (/\.svg/i.test(url)) return "image/svg+xml";
    return "image/jpeg"; // safe fallback for other image extensions
  }
  // Also accept octet-stream (common for CDN-served images)
  if (ct === "application/octet-stream") return "image/jpeg";
  return null;
}

/**
 * Download an image URL to Vercel Blob. Returns the blob URL and mime type.
 * Tolerant of servers that send wrong content-types for image URLs.
 */
async function downloadToBlob(
  url: string,
  slugBase: string,
  label: string
): Promise<{ blobUrl: string; mimeType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  const resp = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "GlobescraperBot/1.0 (+https://globescraper.com)",
      Accept: "image/*",
    },
  });
  clearTimeout(timer);

  if (!resp.ok) {
    throw new Error(`Failed to download image (${resp.status}).`);
  }

  const ct = resp.headers.get("content-type") || "";
  const mimeType = resolveImageMime(ct, url);
  if (!mimeType) {
    throw new Error(
      "URL does not appear to be an image. The server returned content-type: " +
        (ct || "none") +
        ". Try a URL ending in .jpg, .png, or .webp."
    );
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength < 1_000) {
    throw new Error("Downloaded file is too small to be a real image.");
  }

  const ext =
    mimeType.includes("jpeg") || mimeType.includes("jpg")
      ? "jpg"
      : mimeType.includes("webp")
        ? "webp"
        : mimeType.includes("png")
          ? "png"
          : "jpg";
  const filename = `blog-images/${slugBase}-${label}-${Date.now()}.${ext}`;

  const blob = await put(filename, buf, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: true,
  });

  return { blobUrl: blob.url, mimeType };
}

/* ── Action types ─────────────────────────────────────────── */

interface SetUrlAction {
  action: "set-url";
  slot: string; // "hero" or heading text
  url: string;
  altText?: string;
  caption?: string;
}

interface RegenerateAction {
  action: "regenerate";
  slot: string;
}

interface UpdateSeoAction {
  action: "update-seo";
  slot: string;
  altText: string;
  caption: string;
}

interface GenerateSeoAction {
  action: "generate-seo";
  slot: string;
}

type ImageAction = SetUrlAction | RegenerateAction | UpdateSeoAction | GenerateSeoAction;

/**
 * POST /api/admin/blog/[id]/images
 * Unified image management endpoint.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const body = (await req.json()) as ImageAction;
    if (!body.action || !body.slot) {
      return NextResponse.json(
        { error: "action and slot are required." },
        { status: 400 }
      );
    }

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        slug: true,
        title: true,
        topic: true,
        markdown: true,
        heroImageUrl: true,
        imagesJson: true,
      },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const slugBase = post.slug.slice(0, 40);
    const isHero = body.slot === "hero";

    switch (body.action) {
      /* ── SET URL ─────────────────────────────────────────── */
      case "set-url": {
        const { url, altText, caption } = body;
        if (!url) {
          return NextResponse.json({ error: "URL is required." }, { status: 400 });
        }
        try { new URL(url); } catch {
          return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
        }

        let blobUrl: string;
        try {
          const result = await downloadToBlob(url, slugBase, isHero ? "hero-custom" : "inline-custom");
          blobUrl = result.blobUrl;
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Download failed." },
            { status: 400 }
          );
        }

        const alt = altText || (isHero ? post.title : body.slot);
        const cap = caption || "";

        // Update markdown
        let markdown = post.markdown;
        if (isHero) {
          markdown = replaceHeroImage(markdown, blobUrl, alt);
        } else {
          markdown = replaceSectionImage(markdown, body.slot, blobUrl, alt, cap);
        }

        // Update DB
        const updateData: Record<string, unknown> = { markdown, updatedAt: new Date() };
        if (isHero) updateData.heroImageUrl = blobUrl;
        updateData.imagesJson = buildImagesJson(markdown);

        await prisma.generatedArticleDraft.update({
          where: { id: params.id },
          data: updateData,
        });

        revalidatePath(`/${post.slug}`);
        revalidatePath("/blog");

        return NextResponse.json({ success: true, imageUrl: blobUrl, altText: alt, caption: cap });
      }

      /* ── REGENERATE ──────────────────────────────────────── */
      case "regenerate": {
        const style = "Natural lighting, candid feel, no text overlays, no watermarks, no logos.";
        const noText = "Do not include any text in the image.";

        let prompt: string;
        let width: number;
        let height: number;
        let kind: "HERO" | "INLINE";

        if (isHero) {
          kind = "HERO";
          width = 1344;
          height = 768;
          prompt = `Photorealistic travel documentary photograph of Cambodia. Wide landscape shot directly relevant to the article title: "${post.title}". Focus on real places, architecture, and atmosphere. ${style} ${noText}`;
        } else {
          kind = "INLINE";
          width = 1024;
          height = 576;
          prompt = `Photorealistic travel documentary photograph of Cambodia. Scene directly relevant to the section "${body.slot}" in an article about "${post.title}". ${style} ${noText}`;
        }

        const specs: ImageSpec[] = [{
          kind,
          prompt,
          altText: isHero
            ? `Cambodia scene related to ${post.title.toLowerCase()}`.slice(0, 125)
            : `${body.slot} in Cambodia`.slice(0, 125),
          width,
          height,
          sectionHeading: isHero ? undefined : body.slot,
        }];

        const generated = await generateHybridImages(post.title, specs, slugBase);
        if (generated.length === 0) {
          return NextResponse.json({ error: "Image generation failed." }, { status: 500 });
        }

        const img = generated[0];
        let markdown = post.markdown;
        if (isHero) {
          markdown = replaceHeroImage(markdown, img.storageUrl, img.altText);
        } else {
          markdown = replaceSectionImage(
            markdown, body.slot, img.storageUrl,
            img.altText, img.caption || ""
          );
        }

        const updateData: Record<string, unknown> = { markdown, updatedAt: new Date() };
        if (isHero) updateData.heroImageUrl = img.storageUrl;
        updateData.imagesJson = buildImagesJson(markdown);

        await prisma.generatedArticleDraft.update({
          where: { id: params.id },
          data: updateData,
        });

        revalidatePath(`/${post.slug}`);
        revalidatePath("/blog");

        return NextResponse.json({
          success: true,
          imageUrl: img.storageUrl,
          altText: img.altText,
          caption: img.caption || "",
        });
      }

      /* ── UPDATE SEO (alt text + caption) ─────────────────── */
      case "update-seo": {
        const { altText, caption } = body;
        let markdown = post.markdown;

        if (isHero) {
          // Hero: update alt text in ![alt](url) after H1
          markdown = markdown.replace(
            /^(# .+\n\n)!\[[^\]]*\]\(([^)]+)\)\n/m,
            `$1![${altText}]($2)\n`
          );
        } else {
          // Inline: update alt text and caption after section heading
          markdown = updateSectionSeo(markdown, body.slot, altText, caption);
        }

        await prisma.generatedArticleDraft.update({
          where: { id: params.id },
          data: { markdown, imagesJson: buildImagesJson(markdown), updatedAt: new Date() },
        });

        revalidatePath(`/${post.slug}`);
        return NextResponse.json({ success: true, altText, caption });
      }

      /* ── GENERATE SEO via AI ─────────────────────────────── */
      case "generate-seo": {
        const sectionContext = isHero ? post.title : body.slot;
        const prompt = `Generate SEO-optimised alt text and caption for a blog image.

Article title: "${post.title}"
Image section: "${sectionContext}"
Location: Cambodia

Return ONLY JSON (no markdown fences):
{"altText":"descriptive alt text under 125 chars, good for accessibility and SEO","caption":"engaging caption under 80 chars"}`;

        const response = await callGeminiText(prompt);
        const cleaned = response.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        let parsed: { altText: string; caption: string };
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          return NextResponse.json(
            { error: "AI returned invalid JSON. Try again." },
            { status: 500 }
          );
        }

        const altText = (parsed.altText || "").slice(0, 125);
        const caption = (parsed.caption || "").slice(0, 100);

        // Also save to markdown
        let markdown = post.markdown;
        if (isHero) {
          markdown = markdown.replace(
            /^(# .+\n\n)!\[[^\]]*\]\(([^)]+)\)\n/m,
            `$1![${altText}]($2)\n`
          );
        } else {
          markdown = updateSectionSeo(markdown, body.slot, altText, caption);
        }

        await prisma.generatedArticleDraft.update({
          where: { id: params.id },
          data: { markdown, imagesJson: buildImagesJson(markdown), updatedAt: new Date() },
        });

        revalidatePath(`/${post.slug}`);
        return NextResponse.json({ success: true, altText, caption });
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    console.error("[Image Manager] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 500 }
    );
  }
}

/* ── Markdown helpers ─────────────────────────────────────── */

function replaceHeroImage(markdown: string, url: string, alt: string): string {
  const heroPattern = /^(# .+)\n\n!\[[^\]]*\]\([^)]+\)\n/m;
  if (heroPattern.test(markdown)) {
    return markdown.replace(heroPattern, `$1\n\n![${alt}](${url})\n`);
  }
  // No existing hero image — insert one after H1
  const h1Match = markdown.match(/^(# .+)$/m);
  if (h1Match) {
    return markdown.replace(h1Match[0], `${h1Match[0]}\n\n![${alt}](${url})\n`);
  }
  return markdown;
}

function replaceSectionImage(
  markdown: string,
  heading: string,
  url: string,
  alt: string,
  caption: string
): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Try to replace existing image after the heading
  const withImagePattern = new RegExp(
    `^(## ${escaped}[^\\n]*)\\n\\n!\\[[^\\]]*\\]\\([^)]+\\)\\n?(?:\\*[^*]+\\*\\n?)?`,
    "m"
  );
  if (withImagePattern.test(markdown)) {
    const captionMd = caption ? `\n*${caption}*` : "";
    return markdown.replace(
      withImagePattern,
      `$1\n\n![${alt}](${url})${captionMd}`
    );
  }
  // No existing image — insert one after the heading
  const headingPattern = new RegExp(`^(## ${escaped}[^\\n]*)$`, "m");
  if (headingPattern.test(markdown)) {
    const captionMd = caption ? `\n*${caption}*` : "";
    return markdown.replace(
      headingPattern,
      `$1\n\n![${alt}](${url})${captionMd}`
    );
  }
  return markdown;
}

function updateSectionSeo(
  markdown: string,
  heading: string,
  altText: string,
  caption: string
): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: ## Heading\n\n![old alt](url)\n*old caption*
  const fullPattern = new RegExp(
    `^(## ${escaped}[^\\n]*)\\n\\n!\\[[^\\]]*\\]\\(([^)]+)\\)\\n?(?:\\*[^*]+\\*\\n?)?`,
    "m"
  );
  if (fullPattern.test(markdown)) {
    const captionMd = caption ? `\n*${caption}*` : "";
    return markdown.replace(
      fullPattern,
      `$1\n\n![${altText}]($2)${captionMd}`
    );
  }
  return markdown;
}

/**
 * Build a simplified images JSON from the current markdown.
 * This keeps the imagesJson field in sync with markdown edits.
 */
function buildImagesJson(markdown: string): Array<Record<string, string>> {
  const images: Array<Record<string, string>> = [];

  // Hero image after H1
  const heroMatch = markdown.match(/^# .+\n\n!\[([^\]]*)\]\(([^)]+)\)/m);
  if (heroMatch) {
    images.push({ kind: "HERO", altText: heroMatch[1], storageUrl: heroMatch[2] });
  }

  // Inline images after H2 headings
  const inlinePattern = /^## ([^\n]+)\n\n!\[([^\]]*)\]\(([^)]+)\)(?:\n\*([^*]+)\*)?/gm;
  let match;
  while ((match = inlinePattern.exec(markdown)) !== null) {
    images.push({
      kind: "INLINE",
      sectionHeading: match[1].trim(),
      altText: match[2],
      storageUrl: match[3],
      caption: match[4] || "",
    });
  }

  return images;
}
