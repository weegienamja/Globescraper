import type { Metadata } from "next";
import { getPostsMeta, getPagesMeta } from "@/lib/content";
import { getPublishedAiPosts, inferCategory } from "@/lib/published-posts";
import { BlogCollectionJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { BlogPageClient, type BlogPost } from "@/components/BlogPageClient";

/**
 * ISR -- revalidate every 10 minutes so new posts appear promptly
 * while still serving cached pages to crawlers and visitors.
 */
export const revalidate = 600;

export function generateMetadata(): Metadata {
  const meta = getPagesMeta().blog;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: "/blog" },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: "/blog",
      images: [{ url: "/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/og-default.png"],
    },
  };
}

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function BlogIndex() {
  const staticPosts = getPostsMeta();

  // Graceful fallback: if DB is unavailable, show only static posts
  let aiPosts: Awaited<ReturnType<typeof getPublishedAiPosts>> = [];
  try {
    aiPosts = await getPublishedAiPosts();
  } catch (e) {
    console.error("[BlogIndex] DB error fetching AI posts:", e);
  }

  // Merge and deduplicate by slug, newest first
  const slugSet = new Set<string>();
  const allPosts: BlogPost[] = [];

  // AI posts first (they have markdown for reading time + category)
  for (const p of aiPosts) {
    if (!slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      allPosts.push({
        slug: p.slug,
        title: p.title,
        description: p.description,
        date: p.date,
        category: p.category || inferCategory(p.title + " " + p.description),
        readingTime: estimateReadingTime(p.markdown),
        heroImageUrl: p.heroImageUrl,
      });
    }
  }
  // Then static posts
  for (const p of staticPosts) {
    if (!slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      allPosts.push({
        slug: p.slug,
        title: p.title,
        description: p.description,
        date: p.date,
        category: inferCategory(p.title + " " + p.description),
        readingTime: estimateReadingTime(p.description),
        heroImageUrl: null,
      });
    }
  }

  // Sort all posts newest-first by date
  allPosts.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
        ]}
      />
      <BlogCollectionJsonLd
        posts={allPosts.map((p) => ({
          title: p.title.replace(" | GlobeScraper", ""),
          url: `/${p.slug}`,
          datePublished: p.date,
          image: p.heroImageUrl || undefined,
        }))}
      />
      <h1>Blog</h1>
      <p className="small">Teaching in Southeast Asia, without the fluff.</p>
      <BlogPageClient posts={allPosts} />
    </section>
  );
}
