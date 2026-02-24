import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { HtmlContent } from "@/components/HtmlContent";
import { getPostsMeta, getHtmlForPost } from "@/lib/content";
import { getHeroImage } from "@/lib/contentImages";

export function generateStaticParams() {
  return getPostsMeta().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostsMeta().find((p) => p.slug === params.slug);
  if (!post) return {};
  const cleanTitle = post.title.replace(" | GlobeScraper", "");
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/${post.slug}` },
    openGraph: {
      title: cleanTitle,
      description: post.description,
      url: `/${post.slug}`,
      type: "article",
      images: [{ url: getHeroImage(post.slug) }],
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPostsMeta().find((p) => p.slug === params.slug);
  if (!post) return notFound();
  const html = getHtmlForPost(post.slug);
  const heroSrc = getHeroImage(post.slug);
  return (
    <>
      <Image
        src={heroSrc}
        alt={post.title.replace(" | GlobeScraper", "")}
        width={980}
        height={520}
        priority
        style={{ width: "100%", height: "auto", borderRadius: "var(--radius)", marginBottom: 24 }}
      />
      <HtmlContent html={html} />
    </>
  );
}
