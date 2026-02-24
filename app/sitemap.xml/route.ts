import { getPostsMeta } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export function GET() {
  const base = siteConfig.url;
  const today = new Date().toISOString().split("T")[0];

  const staticEntries = [
    "",
    "/blog",
    "/about",
    "/how-it-works-to-teach-english",
  ].map((p) => `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod></url>`);

  const postEntries = getPostsMeta().map(
    (p) => `  <url><loc>${base}/${p.slug}</loc><lastmod>${p.date}</lastmod></url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...postEntries].join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
