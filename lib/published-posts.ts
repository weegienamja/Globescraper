import { prisma } from "@/lib/prisma";

/* ── Category inference from title/description keywords ──── */
const CATEGORY_RULES: [string, RegExp][] = [
  ["Teaching", /teach|tefl|esl|efl|instructor|classroom/i],
  ["Visas", /visa|immigration|work permit|extension|overstay/i],
  ["Safety", /safety|scam|crime|danger|secure|warning/i],
  ["Airports", /airport|flight|airline|terminal|techo/i],
  ["Healthcare", /health|hospital|clinic|medical|doctor|pharmacy|dentist/i],
  ["Digital Nomad", /digital nomad|remote work|cowork|freelanc/i],
  ["Travel", /travel|backpack|siem reap|angkor|island|beach|sihanoukville/i],
  ["Border News", /border|thailand.*cambodia|crossing|checkpoint/i],
  ["Rentals", /rental|rent|apartment|condo|landlord|lease|housing/i],
];

export function inferCategory(text: string): string {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(text)) return cat;
  }
  return "Travel";
}

export interface PublishedAiPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  modifiedDate: string;
  author: string;
  markdown: string;
  city: string;
  heroImageUrl: string | null;
  ogImageUrl: string | null;
  category: string | null;
  isAiGenerated: true;
}

/**
 * Fetch all published AI-generated articles from the database.
 * Returns them in the same shape as static PostMeta (plus markdown body).
 */
export async function getPublishedAiPosts(): Promise<PublishedAiPost[]> {
  const drafts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      metaDescription: true,
      markdown: true,
      city: true,
      heroImageUrl: true,
      ogImageUrl: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return drafts.map((d) => ({
    slug: d.slug,
    title: d.title,
    description: d.metaDescription,
    date: d.createdAt.toISOString().split("T")[0],
    modifiedDate: d.updatedAt.toISOString().split("T")[0],
    author: "GlobeScraper",
    markdown: d.markdown,
    city: d.city,
    heroImageUrl: d.heroImageUrl,
    ogImageUrl: d.ogImageUrl,
    category: d.category || inferCategory(d.title + " " + d.metaDescription),
    isAiGenerated: true as const,
  }));
}

/**
 * Fetch a single published AI article by slug.
 */
export async function getPublishedAiPost(slug: string): Promise<PublishedAiPost | null> {
  const draft = await prisma.generatedArticleDraft.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      markdown: true,
      city: true,
      heroImageUrl: true,
      ogImageUrl: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!draft) return null;

  return {
    slug: draft.slug,
    title: draft.title,
    description: draft.metaDescription,
    date: draft.createdAt.toISOString().split("T")[0],
    modifiedDate: draft.updatedAt.toISOString().split("T")[0],
    author: "GlobeScraper",
    markdown: draft.markdown,
    city: draft.city,
    heroImageUrl: draft.heroImageUrl,
    ogImageUrl: draft.ogImageUrl,
    category: draft.category || inferCategory(draft.title + " " + draft.metaDescription),
    isAiGenerated: true as const,
  };
}
