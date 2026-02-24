import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPostsMeta, getPagesMeta } from "@/lib/content";
import { getHeroImage } from "@/lib/contentImages";
import { BlogCardTracker } from "@/components/BlogCardTracker";

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
    },
  };
}

export default function BlogIndex() {
  const posts = getPostsMeta();
  return (
    <section>
      <h1>Blog</h1>
      <p className="small">Teaching in Cambodia, without the fluff.</p>
      <div className="blog-list">
        {posts.map((p) => (
          <BlogCardTracker key={p.slug} slug={p.slug}>
            <article className="card">
              <Link href={`/${p.slug}`} className="card__image-link">
                <Image
                  src={getHeroImage(p.slug)}
                  alt={p.title.replace(" | GlobeScraper", "")}
                  width={160}
                  height={90}
                  className="card__image"
                />
              </Link>
              <div className="card__body">
                <div className="small">{p.date}</div>
                <h2 className="card__title">
                  <Link href={`/${p.slug}`} className="card__title-clamp">
                    {p.title.replace(" | GlobeScraper", "")}
                  </Link>
                </h2>
                <p className="small card__excerpt card__excerpt-clamp">{p.description}</p>
              </div>
            </article>
          </BlogCardTracker>
        ))}
      </div>
    </section>
  );
}
