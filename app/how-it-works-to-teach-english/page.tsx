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
      images: [{ url: "/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/og-default.png"],
    },
  };
}

export default function Page() {
  const html = getHtmlForPage("how-it-works-to-teach-english");
  return <HtmlContent html={html} />;
}
