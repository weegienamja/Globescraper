/**
 * One-time script: Fix broken images on published posts.
 * 1. Strips ALL fake image markdown from the post
 * 2. Generates real images with Imagen 3
 * 3. Uploads to Vercel Blob
 * 4. Injects real image markdown into the post
 * 5. Updates heroImageUrl, ogImageUrl, and images in the DB
 *
 * Usage: npx tsx scripts/fix-post-images.ts
 *
 * Requires: GEMINI_API_KEY and BLOB_READ_WRITE_TOKEN in .env / .env.local
 */

import { PrismaClient } from "@prisma/client";
import {
  buildImageSpecs,
  generateAndUploadImages,
  injectImagesIntoMarkdown,
  extractHeadings,
} from "@/lib/ai/imageGen";

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      city: true,
      topic: true,
      markdown: true,
      heroImageUrl: true,
      ogImageUrl: true,
    },
  });

  for (const post of posts) {
    console.log(`\n=== Processing: ${post.slug} ===`);

    // 1. Strip ALL image markdown (fake URLs)
    let cleanMarkdown = post.markdown.replace(/!\[.*?\]\(https?:\/\/[^)]+\)\n?/g, "");
    const stripped = post.markdown.length - cleanMarkdown.length;
    if (stripped > 0) {
      console.log(`  Stripped ${stripped} chars of fake image markdown`);
    }

    // 2. Build image specs
    const headings = extractHeadings(cleanMarkdown);
    console.log(`  Found ${headings.length} section headings`);
    const specs = buildImageSpecs(post.city, post.topic, post.title, headings);
    console.log(`  Built ${specs.length} image specs (HERO, OG, ${specs.filter(s => s.kind === "INLINE").length} INLINE)`);

    // 3. Generate images with Imagen 3 and upload to Vercel Blob
    console.log("  Generating images with Imagen 3...");
    const slugBase = post.slug.slice(0, 40);
    const generatedImages = await generateAndUploadImages(specs, slugBase);
    console.log(`  Generated ${generatedImages.length}/${specs.length} images`);

    if (generatedImages.length === 0) {
      console.log("  ERROR: No images generated. Saving cleaned markdown only.");
      await prisma.generatedArticleDraft.update({
        where: { id: post.id },
        data: { markdown: cleanMarkdown },
      });
      continue;
    }

    // 4. Find hero and OG images
    const hero = generatedImages.find((img) => img.kind === "HERO");
    const og = generatedImages.find((img) => img.kind === "OG");
    console.log(`  HERO: ${hero?.storageUrl ?? "NONE"}`);
    console.log(`  OG:   ${og?.storageUrl ?? "NONE"}`);

    // 5. Inject images into markdown
    const finalMarkdown = injectImagesIntoMarkdown(cleanMarkdown, generatedImages);

    // 6. Build image records for DB
    const imageRecords = generatedImages.map((img) => ({
      kind: img.kind,
      prompt: img.prompt,
      altText: img.altText,
      caption: img.caption || null,
      width: img.width,
      height: img.height,
      mimeType: img.mimeType,
      storageUrl: img.storageUrl,
    }));

    // 7. Update the draft in DB
    await prisma.generatedArticleDraft.update({
      where: { id: post.id },
      data: {
        markdown: finalMarkdown,
        heroImageUrl: hero?.storageUrl ?? null,
        ogImageUrl: og?.storageUrl ?? null,
      },
    });

    // 8. Create image records (delete old ones first)
    await prisma.generatedArticleImage.deleteMany({
      where: { draftId: post.id },
    });
    for (const img of imageRecords) {
      await prisma.generatedArticleImage.create({
        data: {
          draftId: post.id,
          ...img,
        },
      });
    }

    console.log(`  ✓ Updated post with ${generatedImages.length} real images`);
  }

  await prisma.$disconnect();
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
