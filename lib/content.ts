import fs from "node:fs";
import path from "node:path";

export type PostMeta = { slug: string; title: string; description: string; date: string };
export type PageMeta = { title: string; description: string };

const contentRoot = path.join(process.cwd(), "content");

export function getPostsMeta(): PostMeta[] {
  const p = path.join(contentRoot, "posts.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as PostMeta[];
}

export function getPagesMeta(): Record<string, PageMeta> {
  const p = path.join(contentRoot, "pages.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, PageMeta>;
}

export function getHtmlForPost(slug: string): string {
  const safeName = path.basename(slug);
  const p = path.join(contentRoot, "posts", `${safeName}.html`);
  const resolved = path.resolve(p);
  if (!resolved.startsWith(path.resolve(contentRoot, "posts"))) {
    throw new Error("Invalid post slug");
  }
  return fs.readFileSync(resolved, "utf-8");
}

export function getHtmlForPage(slug: string): string {
  const safeName = path.basename(slug);
  const filename = safeName === "index" ? "index.html" : `${safeName}.html`;
  const p = path.join(contentRoot, "pages", filename);
  const resolved = path.resolve(p);
  if (!resolved.startsWith(path.resolve(contentRoot, "pages"))) {
    throw new Error("Invalid page slug");
  }
  return fs.readFileSync(resolved, "utf-8");
}
