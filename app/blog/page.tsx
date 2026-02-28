import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPostsMeta, getPagesMeta } from "@/lib/content";
import { getHeroImage } from "@/lib/contentImages";
import { BlogCardTracker } from "@/components/BlogCardTracker";
import { getPublishedAiPosts } from "@/lib/published-posts";
import { BlogCollectionJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";

/**
 * ISR – revalidate every 10 minutes so new posts appear promptly
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
  const allPosts: Array<{
    slug: string;
    title: string;
    description: string;
    date: string;
    isAiGenerated?: boolean;
    heroImageUrl?: string | null;
  }> = [];

  // AI posts first (they're newer)
  for (const p of aiPosts) {
    if (!slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      allPosts.push({ ...p, isAiGenerated: true, heroImageUrl: p.heroImageUrl });
    }
  }
  // Then static posts
  for (const p of staticPosts) {
    if (!slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      allPosts.push(p);
    }
  }

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
      <div className="blog-list">
        {allPosts.map((p) => (
          <BlogCardTracker key={p.slug} slug={p.slug}>
            <Link href={`/${p.slug}`} className="card card--link">
              <div className="card__image-wrapper">
                <Image
                  src={p.heroImageUrl || getHeroImage(p.slug)}
                  alt={p.title.replace(" | GlobeScraper", "")}
                  width={160}
                  height={90}
                  className="card__image"
                  unoptimized={!!p.heroImageUrl}
                />
              </div>
              <div className="card__body">
                <div className="small">{p.date}</div>
                <h2 className="card__title card__title-clamp">
                  {p.title.replace(" | GlobeScraper", "")}
                </h2>
                <p className="small card__excerpt card__excerpt-clamp">{p.description}</p>
              </div>
            </Link>
          </BlogCardTracker>
        ))}
      </div>
    </section>
  );
}
