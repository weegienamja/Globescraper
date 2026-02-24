import { HtmlContent } from "@/components/HtmlContent";
import { getHtmlForPage, getPagesMeta } from "@/lib/content";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  const meta = getPagesMeta()["how-it-works-to-teach-english"];
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: "/how-it-works-to-teach-english" },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: "/how-it-works-to-teach-english",
    },
  };
}

export default function Page() {
  const html = getHtmlForPage("how-it-works-to-teach-english");
  return <HtmlContent html={html} />;
}
