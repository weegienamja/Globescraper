import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { HtmlContent } from "@/components/HtmlContent";
import { MarkdownContent } from "@/components/MarkdownContent";
import { RecommendedPosts } from "@/components/RecommendedPosts";
import { getPostsMeta, getHtmlForPost } from "@/lib/content";
import { getHeroImage } from "@/lib/contentImages";
import { getPublishedAiPost, getPublishedAiPosts } from "@/lib/published-posts";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";

/**
 * AI-published posts come from the database, so allow dynamic params
 * beyond the statically generated set.
 */
export const dynamicParams = true;

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

  // Check AI-published posts
  const aiPost = await getPublishedAiPost(params.slug);
  if (aiPost) {
    const heroImage = getHeroImage(aiPost.slug);
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
        images: [{ url: heroImage }],
      },
      twitter: {
        card: "summary_large_image",
        title: aiPost.title,
        description: aiPost.description,
        images: [heroImage],
      },
    };
  }

  return {};
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  // Resolve post from static or AI sources
  const staticPost = getPostsMeta().find((p) => p.slug === params.slug);
  const aiPost = !staticPost ? await getPublishedAiPost(params.slug) : null;

  if (!staticPost && !aiPost) return notFound();

  // Determine values for current post
  const isAi = !!aiPost;
  const slug = isAi ? aiPost.slug : staticPost!.slug;
  const title = isAi ? aiPost.title : staticPost!.title.replace(" | GlobeScraper", "");
  const description = isAi ? aiPost.description : staticPost!.description;
  const date = isAi ? aiPost.date : staticPost!.date;
  const modifiedDate = isAi ? aiPost.modifiedDate : staticPost!.modifiedDate;
  const author = isAi ? aiPost.author : staticPost!.author;
  const heroSrc = getHeroImage(slug);

  // Build recommended posts list (all posts except current, max 6)
  const staticPosts = getPostsMeta();
  const aiPosts = await getPublishedAiPosts();
  const slugSet = new Set<string>();
  const recommended: Array<{ slug: string; title: string; description: string; isAiGenerated?: boolean }> = [];

  for (const p of aiPosts) {
    if (p.slug !== slug && !slugSet.has(p.slug)) {
      slugSet.add(p.slug);
      recommended.push({ slug: p.slug, title: p.title, description: p.description, isAiGenerated: true });
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

      <div className="post-layout">
        <div className="post-layout__main">
          <Image
            src={heroSrc}
            alt={title}
            width={980}
            height={520}
            priority
            style={{ width: "100%", height: "auto", borderRadius: "var(--radius)", marginBottom: 24 }}
          />
          {isAi ? (
            <MarkdownContent markdown={aiPost.markdown} />
          ) : (
            <HtmlContent html={getHtmlForPost(staticPost!.slug)} />
          )}
        </div>

        {/* Desktop sidebar */}
        <div className="post-layout__sidebar">
          <RecommendedPosts posts={topRecommended} />
        </div>
      </div>

      {/* Mobile/tablet bottom strip */}
      <div className="post-layout__bottom-rec">
        <RecommendedPosts posts={topRecommended} />
      </div>
    </>
  );
}
