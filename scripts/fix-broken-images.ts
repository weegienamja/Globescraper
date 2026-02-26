/**
 * One-time script: strip hallucinated image markdown from published posts.
 * Run with: npx tsx scripts/fix-broken-images.ts
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, markdown: true },
  });

  for (const post of posts) {
    // Strip image markdown with http(s) URLs (hallucinated by Gemini)
    const cleaned = post.markdown.replace(/!\[.*?\]\(https?:\/\/[^)]+\)\n?/g, "");

    if (cleaned !== post.markdown) {
      const removed = post.markdown.length - cleaned.length;
      console.log(`[${post.slug}] Removing ${removed} chars of fake image markdown`);
      await prisma.generatedArticleDraft.update({
        where: { id: post.id },
        data: { markdown: cleaned },
      });
      console.log(`  ✓ Updated`);
    } else {
      console.log(`[${post.slug}] No fake images found`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
