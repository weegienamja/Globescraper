import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { generateHybridImages } from "@/lib/ai/imageSearch";
import { extractHeadings, type ImageSpec } from "@/lib/ai/imageGen";

export const maxDuration = 120;

/**
 * PATCH /api/admin/blog/[id]/hero-image
 * Set hero image from a custom URL. Downloads to Vercel Blob first.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const { url } = (await req.json()) as { url?: string };
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true, markdown: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    // Download image to Vercel Blob to avoid hotlinking
    let blobUrl: string;
    try {
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
        return NextResponse.json(
          { error: `Failed to download image (${resp.status}).` },
          { status: 400 }
        );
      }

      const ct = resp.headers.get("content-type") || "image/jpeg";
      if (!ct.startsWith("image/")) {
        return NextResponse.json(
          { error: "URL does not point to an image." },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await resp.arrayBuffer());
      const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
      const filename = `blog-images/${post.slug.slice(0, 40)}-hero-custom-${Date.now()}.${ext}`;

      const blob = await put(filename, buf, {
        access: "public",
        contentType: ct,
        addRandomSuffix: true,
      });
      blobUrl = blob.url;
    } catch (err) {
      console.error("[Hero Image PATCH] Download failed:", err);
      return NextResponse.json(
        { error: "Failed to download the image. Check the URL." },
        { status: 400 }
      );
    }

    // Update hero in markdown (replace the first image after H1)
    let markdown = post.markdown;
    const heroPattern = /^(# .+)\n\n!\[[^\]]*\]\([^)]+\)\n/m;
    if (heroPattern.test(markdown)) {
      markdown = markdown.replace(
        heroPattern,
        `$1\n\n![Hero image](${blobUrl})\n`
      );
    }

    // Save and publish
    await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: {
        heroImageUrl: blobUrl,
        markdown,
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/${post.slug}`);
    revalidatePath("/blog");

    return NextResponse.json({
      success: true,
      heroImageUrl: blobUrl,
    });
  } catch (error) {
    console.error("[Hero Image PATCH] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/blog/[id]/hero-image
 * Regenerate the hero image using the hybrid pipeline (real/AI).
 * Only regenerates the hero — not OG or inline images.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true, title: true, topic: true, markdown: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    // Build a single hero image spec
    const style = "Natural lighting, candid feel, no text overlays, no watermarks, no logos.";
    const noText = "Do not include any text in the image.";
    const specs: ImageSpec[] = [
      {
        kind: "HERO",
        prompt: `Photorealistic travel documentary photograph of Cambodia. Wide landscape shot directly relevant to the article title: "${post.title}". Focus on real places, architecture, and atmosphere. ${style} ${noText}`,
        altText: `Cambodia scene related to ${post.title.toLowerCase()}`.slice(0, 125),
        width: 1344,
        height: 768,
      },
    ];

    const slugBase = post.slug.slice(0, 40);
    const generated = await generateHybridImages(post.title, specs, slugBase);

    if (generated.length === 0) {
      return NextResponse.json(
        { error: "Image generation failed. Try again." },
        { status: 500 }
      );
    }

    const hero = generated[0];

    // Update hero in markdown
    let markdown = post.markdown;
    const heroPattern = /^(# .+)\n\n!\[[^\]]*\]\([^)]+\)\n/m;
    if (heroPattern.test(markdown)) {
      markdown = markdown.replace(
        heroPattern,
        `$1\n\n![${hero.altText}](${hero.storageUrl})\n`
      );
    }

    // Save and publish
    await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: {
        heroImageUrl: hero.storageUrl,
        markdown,
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/${post.slug}`);
    revalidatePath("/blog");

    return NextResponse.json({
      success: true,
      heroImageUrl: hero.storageUrl,
    });
  } catch (error) {
    console.error("[Hero Image POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 500 }
    );
  }
}
