import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { HtmlContent } from "@/components/HtmlContent";
import { getPostsMeta, getHtmlForPost } from "@/lib/content";
import { getHeroImage } from "@/lib/contentImages";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return getPostsMeta().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostsMeta().find((p) => p.slug === params.slug);
  if (!post) return {};
  const cleanTitle = post.title.replace(" | GlobeScraper", "");
  const heroImage = getHeroImage(post.slug);
  return {
    title: cleanTitle,
    description: post.description,
    alternates: { canonical: `/${post.slug}` },
    openGraph: {
      title: cleanTitle,
      description: post.description,
      url: `/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modifiedDate ?? post.date,
      authors: [post.author ?? "Jamie"],
      images: [{ url: heroImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: cleanTitle,
      description: post.description,
      images: [heroImage],
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPostsMeta().find((p) => p.slug === params.slug);
  if (!post) return notFound();
  const html = getHtmlForPost(post.slug);
  const heroSrc = getHeroImage(post.slug);
  const cleanTitle = post.title.replace(" | GlobeScraper", "");
  return (
    <>
      <ArticleJsonLd
        title={cleanTitle}
        description={post.description}
        url={`/${post.slug}`}
        image={heroSrc}
        datePublished={post.date}
        dateModified={post.modifiedDate}
        authorName={post.author}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: cleanTitle, href: `/${post.slug}` },
        ]}
      />
      <Image
        src={heroSrc}
        alt={cleanTitle}
        width={980}
        height={520}
        priority
        style={{ width: "100%", height: "auto", borderRadius: "var(--radius)", marginBottom: 24 }}
      />
      <HtmlContent html={html} />
    </>
  );
}
