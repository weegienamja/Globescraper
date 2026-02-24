import { HtmlContent } from "@/components/HtmlContent";
import { getHtmlForPage, getPagesMeta } from "@/lib/content";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  const meta = getPagesMeta().index;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: "/",
    },
  };
}

export default function HomePage() {
  const html = getHtmlForPage("index");
  return <HtmlContent html={html} />;
}
