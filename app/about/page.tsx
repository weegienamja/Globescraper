import { HtmlContent } from "@/components/HtmlContent";
import { getHtmlForPage, getPagesMeta } from "@/lib/content";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  const meta = getPagesMeta()["about"];
  return { title: meta.title, description: meta.description };
}

export default function Page() {
  const html = getHtmlForPage("about");
  return <HtmlContent html={html} />;
}
