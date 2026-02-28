import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { HtmlContent } from "@/components/HtmlContent";
import { MarkdownContent } from "@/components/MarkdownContent";
import { RecommendedPosts } from "@/components/RecommendedPosts";
import { getPostsMeta, getHtmlForPost } from "@/lib/content";
import { getHeroImage } from "@/lib/contentImages";
import { getPublishedAiPost, getPublishedAiPosts } from "@/lib/published-posts";
import { ArticleJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/JsonLd";
import AdminPostToolbarLazy from "@/components/admin/AdminPostToolbarLazy";
import AdminHeroEditorLazy from "@/components/admin/AdminHeroEditorLazy";

/**
 * Strip the first image that appears immediately after the H1 heading
 * in AI-generated markdown. The page already renders a hero &lt;Image&gt;
 * so this prevents the duplicate.
 */
function stripLeadingHeroImage(markdown: string): string {
  // Match: # Title\n\n![alt](url)\n  — the hero injected by injectImagesIntoMarkdown
  return markdown.replace(/^(# .+)\n\n!\[[^\]]*\]\([^)]+\)\n/m, "$1\n");
}

/**
 * Extract FAQ pairs from markdown. Handles two formats:
 *   **Question?**\nAnswer text.
 *   **Q: Question?**\nAnswer text.
 * Returns empty array if no ## FAQ heading is found.
 */
function extractFAQs(markdown: string): Array<{ question: string; answer: string }> {
  const faqHeadingIdx = markdown.search(/^## FAQ/m);
  if (faqHeadingIdx === -1) return [];

  // Get everything after ## FAQ until the next ## heading or end of file
  const afterFaq = markdown.substring(faqHeadingIdx);
  const nextHeadingMatch = afterFaq.substring(6).search(/^## /m);
  const faqSection = nextHeadingMatch === -1
    ? afterFaq
    : afterFaq.substring(0, nextHeadingMatch + 6);

  const faqs: Array<{ question: string; answer: string }> = [];
  // Match **Q: Question?** or **Question?** followed by answer lines
  const pattern = /\*\*(?:Q:\s*)?(.+?)\*\*\n([\s\S]*?)(?=\n\*\*|$)/g;
  let m;
  while ((m = pattern.exec(faqSection)) !== null) {
    const question = m[1].trim();
    const answer = m[2].trim();
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }
  return faqs;
}

/**
 * AI-published posts come from the database, so allow dynamic params
 * beyond the statically generated set.
 */
export const dynamicParams = true;

/**
 * ISR – serve pages from edge cache, revalidate in background every hour.
 * Critical for Google crawling: without this, every page request triggers
 * a full server render with no-cache headers, causing Googlebot to slow-crawl.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return getPostsMeta().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  // Check static posts first
  const staticPost = getPostsMeta().find((p) => p.slug === params.slug);
  if (staticPost) {
    const cleanTitle = staticPost.title.replace(" | GlobeScraper", "");
    const heroImage = getHeroImage(staticPost.slug);
    return {
      title: cleanTitle,
      description: staticPost.description,
      alternates: { canonical: `/${staticPost.slug}` },
      openGraph: {
        title: cleanTitle,
        description: staticPost.description,
        url: `/${staticPost.slug}`,
        type: "article",
        publishedTime: staticPost.date,
        modifiedTime: staticPost.modifiedDate ?? staticPost.date,
        authors: [staticPost.author ?? "Jamie"],
        images: [{ url: heroImage }],
      },
      twitter: {
        card: "summary_large_image",
        title: cleanTitle,
        description: staticPost.description,
        images: [heroImage],
      },
    };
  }

  // Check AI-published posts (graceful fallback if DB is unavailable)
  let aiPost: Awaited<ReturnType<typeof getPublishedAiPost>> = null;
  try {
    aiPost = await getPublishedAiPost(params.slug);
  } catch (e) {
    console.error(`[generateMetadata] DB error for slug "${params.slug}":`, e);
  }
  if (aiPost) {
    const ogImage = aiPost.ogImageUrl || aiPost.heroImageUrl || getHeroImage(aiPost.slug);
    return {
      title: aiPost.title,
      description: aiPost.description,
      alternates: { canonical: `/${aiPost.slug}` },
      openGraph: {
        title: aiPost.title,
        description: aiPost.description,
        url: `/${aiPost.slug}`,
        type: "article",
        publishedTime: aiPost.date,
        modifiedTime: aiPost.modifiedDate,
        authors: [aiPost.author],
        images: [{ url: ogImage }],
      },
      twitter: {
        card: "summary_large_image",
        title: aiPost.title,
        description: aiPost.description,
        images: [ogImage],
      },
    };
  }

  return {};
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  // Resolve post from static or AI sources
  const staticPost = getPostsMeta().find((p) => p.slug === params.slug);

  // Wrap DB call in try-catch so static posts still render if DB is down
  let aiPost: Awaited<ReturnType<typeof getPublishedAiPost>> = null;
  if (!staticPost) {
    try {
      aiPost = await getPublishedAiPost(params.slug);
    } catch (e) {
      console.error(`[PostPage] DB error fetching AI post "${params.slug}":`, e);
    }
  }

  if (!staticPost && !aiPost) return notFound();

  // Determine values for current post
  const isAi = !!aiPost;
  const slug = isAi ? aiPost.slug : staticPost!.slug;
  const title = isAi ? aiPost.title : staticPost!.title.replace(" | GlobeScraper", "");
  const description = isAi ? aiPost.description : staticPost!.description;
  const date = isAi ? aiPost.date : staticPost!.date;
  const modifiedDate = isAi ? aiPost.modifiedDate : staticPost!.modifiedDate;
  const author = isAi ? aiPost.author : staticPost!.author;
  const heroSrc = isAi ? (aiPost.heroImageUrl || getHeroImage(slug)) : getHeroImage(slug);

  // Extract FAQ items from AI post markdown for structured data
  const faqItems = isAi ? extractFAQs(aiPost.markdown) : [];

  // Build recommended posts list (all posts except current, max 6)
  const staticPosts = getPostsMeta();
  let aiPosts: Awaited<ReturnType<typeof getPublishedAiPosts>> = [];
  try {
    aiPosts = await getPublishedAiPosts();
  } catch (e) {
    console.error("[PostPage] DB error fetching AI posts for recommendations:", e);
  }
  const slugSet = new Set<string>();
  const recommended: Array<{ slug: string; title: string; description: string; isAiGenerated?: boolean; heroImageUrl?: string | null }> = [];

  for (const p of aiPosts) {
    if (p.slug !== slug && !slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      recommended.push({ slug: p.slug, title: p.title, description: p.description, isAiGenerated: true, heroImageUrl: p.heroImageUrl });
    }
  }
  for (const p of staticPosts) {
    if (p.slug !== slug && !slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      recommended.push({ slug: p.slug, title: p.title, description: p.description });
    }
  }
  const topRecommended = recommended.slice(0, 6);

  return (
    <>
      <ArticleJsonLd
        title={title}
        description={description}
        url={`/${slug}`}
        image={heroSrc}
        datePublished={date}
        dateModified={modifiedDate}
        authorName={author}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: title, href: `/${slug}` },
        ]}
      />
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}

      <div className="post-layout">
        <div className="post-layout__main">
          <AdminPostToolbarLazy slug={slug} isAiPost={isAi} />
          <Image
            src={heroSrc}
            alt={title}
            width={980}
            height={520}
            priority
            className="post-hero"
            style={{ width: "100%", maxWidth: "100%", height: "auto", borderRadius: "var(--radius)", marginBottom: 24 }}
          />
          {isAi ? (
            <MarkdownContent markdown={stripLeadingHeroImage(aiPost.markdown)} />
          ) : (
            <HtmlContent html={getHtmlForPost(staticPost!.slug)} />
          )}
        </div>

        {/* Desktop sidebar */}
        <div className="post-layout__sidebar">
          <RecommendedPosts posts={topRecommended} />
          <AdminHeroEditorLazy slug={slug} isAiPost={isAi} heroSrc={heroSrc} />
        </div>
      </div>

      {/* Mobile/tablet bottom strip */}
      <div className="post-layout__bottom-rec">
        <RecommendedPosts posts={topRecommended} />
      </div>
    </>
  );
}
