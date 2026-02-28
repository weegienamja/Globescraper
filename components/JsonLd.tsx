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
 * Includes SiteNavigationElement for site structure signals.
 */
export function WebSiteJsonLd({ url }: WebSiteJsonLdProps = {}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: url ?? siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/main_logo.png`,
      },
      sameAs: [siteConfig.socials.instagram, siteConfig.socials.tiktok],
    },
  };

  const nav = {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    name: siteConfig.navItems.map((n) => n.label),
    url: siteConfig.navItems.map((n) => `${siteConfig.url}${n.href}`),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(nav) }}
      />
    </>
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
        url: `${siteConfig.url}/main_logo.png`,
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

type FAQItem = { question: string; answer: string };

/**
 * FAQPage JSON-LD — placed on pages with FAQ sections.
 */
export function FAQJsonLd({ items }: { items: FAQItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Organization JSON-LD — placed on the /about page.
 * Provides Google with brand identity signals.
 */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: {
      "@type": "ImageObject",
      url: `${siteConfig.url}/main_logo.png`,
    },
    description: siteConfig.description,
    email: siteConfig.email,
    sameAs: [siteConfig.socials.instagram, siteConfig.socials.tiktok],
    foundingDate: "2024",
    founder: {
      "@type": "Person",
      name: "Jamie",
      url: `${siteConfig.url}/about`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

type BlogPostEntry = {
  title: string;
  url: string;
  datePublished: string;
  image?: string;
};

/**
 * CollectionPage JSON-LD — used on the /blog index.
 */
export function BlogCollectionJsonLd({ posts }: { posts: BlogPostEntry[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Cambodia Teaching Blog",
    description:
      "Practical guides, packing lists, cost breakdowns, and real advice for teaching English in Cambodia and Southeast Asia.",
    url: `${siteConfig.url}/blog`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteConfig.url}${p.url}`,
        name: p.title,
      })),
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
