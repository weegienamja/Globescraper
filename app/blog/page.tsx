import Link from "next/link";
import type { Metadata } from "next";
import { getPostsMeta, getPagesMeta } from "@/lib/content";

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
        <article key={p.slug} className="card">
          <div className="small">{p.date}</div>
          <h2 style={{ margin: "8px 0" }}>
            <Link href={`/${p.slug}`}>{p.title.replace(" | GlobeScraper", "")}</Link>
          </h2>
          <p className="small">{p.description}</p>
        </article>
      ))}
    </section>
  );
}
