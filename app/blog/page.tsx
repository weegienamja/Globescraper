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
      {posts.map((p) => (
        <BlogCardTracker key={p.slug} slug={p.slug}>
          <article className="card" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <Link href={`/${p.slug}`} style={{ flexShrink: 0 }}>
              <Image
                src={getHeroImage(p.slug)}
                alt={p.title.replace(" | GlobeScraper", "")}
                width={160}
                height={90}
                style={{ borderRadius: "var(--radius)", objectFit: "cover", width: 160, height: 90 }}
              />
            </Link>
            <div>
              <div className="small">{p.date}</div>
              <h2 style={{ margin: "8px 0" }}>
                <Link href={`/${p.slug}`}>{p.title.replace(" | GlobeScraper", "")}</Link>
              </h2>
              <p className="small">{p.description}</p>
            </div>
          </article>
        </BlogCardTracker>
      ))}
    </section>
  );
}
