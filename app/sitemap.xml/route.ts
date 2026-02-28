import { getPostsMeta } from "@/lib/content";
import { getPublishedAiPosts } from "@/lib/published-posts";
import { siteConfig } from "@/lib/site";

/** Last significant update to static pages (update when content changes). */
const STATIC_LASTMOD = "2026-02-24";

export async function GET() {
  const base = siteConfig.url;

  const staticEntries = [
    { path: "", priority: "1.0", changefreq: "weekly" },
    { path: "/blog", priority: "0.9", changefreq: "weekly" },
    { path: "/about", priority: "0.7", changefreq: "monthly" },
    { path: "/how-it-works-to-teach-english", priority: "0.8", changefreq: "monthly" },
    { path: "/community", priority: "0.7", changefreq: "weekly" },
    { path: "/meetups", priority: "0.7", changefreq: "weekly" },
  ].map(
    (p) =>
      `  <url><loc>${base}${p.path}</loc><lastmod>${STATIC_LASTMOD}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
  );

  const postEntries = getPostsMeta().map(
    (p) =>
      `  <url><loc>${base}/${p.slug}</loc><lastmod>${p.modifiedDate ?? p.date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
  );

  // Include AI-published articles in sitemap
  const aiPosts = await getPublishedAiPosts();
  const staticSlugs = new Set(getPostsMeta().map((p) => p.slug));
  const aiEntries = aiPosts
    .filter((p) => !staticSlugs.has(p.slug))
    .map(
      (p) =>
        `  <url><loc>${base}/${p.slug}</loc><lastmod>${p.modifiedDate ?? p.date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...postEntries, ...aiEntries].join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
