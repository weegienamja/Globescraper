import fs from "node:fs";
import path from "node:path";

export type PostMeta = { slug: string; title: string; description: string; date: string };
export type PageMeta = { title: string; description: string };

const contentRoot = path.join(process.cwd(), "content");

/* ------------------------------------------------------------------ */
/*  Metadata helpers                                                   */
/* ------------------------------------------------------------------ */

export function getPostsMeta(): PostMeta[] {
  const p = path.join(contentRoot, "posts.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as PostMeta[];
}

export function getPagesMeta(): Record<string, PageMeta> {
  const p = path.join(contentRoot, "pages.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, PageMeta>;
}

/* ------------------------------------------------------------------ */
/*  Scraped-HTML cleaning                                              */
/*  Strips the Zyrosite header / footer chrome, fixes broken links,   */
/*  and normalises image paths so only semantic content remains.       */
/* ------------------------------------------------------------------ */

function cleanScrapedHtml(html: string): string {
  let clean = html;

  // 1. Strip header chrome (everything before page content)
  const marker = '<div class="page__blocks"><!--[-->';
  const contentStart = clean.indexOf(marker);
  if (contentStart !== -1) {
    clean = clean.substring(contentStart + marker.length);
  }

  // 2. Strip footer section (always id="zSiG-O")
  const footerStart = clean.lastIndexOf('<section id="zSiG-O"');
  if (footerStart !== -1) {
    clean = clean.substring(0, footerStart);
  }

  // 3. Strip trailing wrapper / Vue comments
  clean = clean.replace(/<!--\]--><\/div>(?:<!---->)*\s*$/s, "");

  // 4. Fix internal .html links → Next.js routes
  clean = clean.replace(/href="index\.html"/g, 'href="/"');
  clean = clean.replace(/href="([^"]+?)\.html"/g, 'href="/$1"');

  // 5. Fix relative image src (../assets.zyrosite.com → https://…)
  clean = clean.replace(
    /src="\.\.\/assets\.zyrosite\.com\//g,
    'src="https://assets.zyrosite.com/',
  );

  return clean.trim();
}

/* ------------------------------------------------------------------ */
/*  HTML loaders (with cleaning)                                       */
/* ------------------------------------------------------------------ */

export function getHtmlForPost(slug: string): string {
  const safeName = path.basename(slug);
  const p = path.join(contentRoot, "posts", `${safeName}.html`);
  const resolved = path.resolve(p);
  if (!resolved.startsWith(path.resolve(contentRoot, "posts"))) {
    throw new Error("Invalid post slug");
  }
  return cleanScrapedHtml(fs.readFileSync(resolved, "utf-8"));
}

export function getHtmlForPage(slug: string): string {
  const safeName = path.basename(slug);
  const filename = safeName === "index" ? "index.html" : `${safeName}.html`;
  const p = path.join(contentRoot, "pages", filename);
  const resolved = path.resolve(p);
  if (!resolved.startsWith(path.resolve(contentRoot, "pages"))) {
    throw new Error("Invalid page slug");
  }
  return cleanScrapedHtml(fs.readFileSync(resolved, "utf-8"));
}
