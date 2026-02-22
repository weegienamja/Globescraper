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
  const p = path.join(contentRoot, "posts", `${slug}.html`);
  return fs.readFileSync(p, "utf-8");
}

export function getHtmlForPage(slug: string): string {
  const filename = slug === "index" ? "index.html" : `${slug}.html`;
  const p = path.join(contentRoot, "pages", filename);
  return fs.readFileSync(p, "utf-8");
}
