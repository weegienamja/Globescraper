import { HtmlContent } from "@/components/HtmlContent";
import { getHtmlForPage, getPagesMeta } from "@/lib/content";
import { BreadcrumbJsonLd, OrganizationJsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  const meta = getPagesMeta()["about"];
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: "/about" },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: "/about",
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
  const html = getHtmlForPage("about");
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "About", href: "/about" },
        ]}
      />
      <OrganizationJsonLd />
      <HtmlContent html={html} />
    </>
  );
}
