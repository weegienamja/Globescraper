import { siteConfig } from "@/lib/site";

type WebSiteJsonLdProps = {
  url?: string;
};

type ArticleJsonLdProps = {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
};

type BreadcrumbItem = {
  name: string;
  href: string;
};

/**
 * WebSite JSON-LD — placed once in the root layout.
 */
export function WebSiteJsonLd({ url }: WebSiteJsonLdProps = {}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: url ?? siteConfig.url,
    description: siteConfig.description,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/logo.png`,
      },
      sameAs: [siteConfig.socials.instagram, siteConfig.socials.tiktok],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Article JSON-LD — placed on individual blog post pages.
 */
export function ArticleJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName = "Jamie",
}: ArticleJsonLdProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${siteConfig.url}${url}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteConfig.url}${url}`,
    },
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: authorName,
      url: `${siteConfig.url}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/logo.png`,
      },
    },
  };

  if (image) {
    data.image = image.startsWith("http")
      ? image
      : `${siteConfig.url}${image}`;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * BreadcrumbList JSON-LD — placed on any page with a breadcrumb trail.
 */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteConfig.url}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
