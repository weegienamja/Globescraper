import { getPostsMeta } from "@/lib/content";

export function GET() {
  const base = "https://globescraper.com";
  const staticUrls = [
    "",
    "/blog",
    "/about",
    "/how-it-works-to-teach-english",
  ].map((p) => `${base}${p}`);

  const postUrls = getPostsMeta().map((p) => `${base}/${p.slug}`);

  const all = [...staticUrls, ...postUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map((u) => `  <url><loc>${u}</loc></url>`)
  .join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
