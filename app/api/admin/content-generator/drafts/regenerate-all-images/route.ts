import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateAndUploadImages,
  injectImagesIntoMarkdown,
  extractHeadings,
  type ImageSpec,
} from "@/lib/ai/imageGen";
import { generateHybridImages } from "@/lib/ai/imageSearch";

export const maxDuration = 300;

/**
 * POST /api/admin/content-generator/drafts/regenerate-all-images
 * Regenerate images for all published (or latest N) drafts that use the
 * fallback hero image or have no heroImageUrl.
 *
 * Body (optional): { limit?: number }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? body.limit : 10;

    // Fetch published drafts that need image regeneration
    const drafts = await prisma.generatedArticleDraft.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        topic: true,
        markdown: true,
        heroImageUrl: true,
      },
    });

    const results: Array<{ id: string; slug: string; success: boolean; imageCount?: number; error?: string }> = [];

    for (const draft of drafts) {
      try {
        const imageSpecs = buildDraftImageSpecs(draft.title, draft.topic, draft.markdown);
        const slugBase = draft.slug.slice(0, 40);
        const generatedImages = await generateHybridImages(draft.title, imageSpecs, slugBase);

        if (generatedImages.length === 0) {
          results.push({ id: draft.id, slug: draft.slug, success: false, error: "No images generated" });
          continue;
        }

        let cleanMarkdown = draft.markdown.replace(/!\[.*?\]\(https?:\/\/[^)]+\)\n?(?:\*[^*]+\*\n?)?/g, "");
        const finalMarkdown = injectImagesIntoMarkdown(cleanMarkdown, generatedImages);

        const hero = generatedImages.find((img) => img.kind === "HERO");
        const og = generatedImages.find((img) => img.kind === "OG");

        const imagesJson = generatedImages.map((img) => ({
          kind: img.kind,
          storageUrl: img.storageUrl,
          altText: img.altText,
          caption: img.caption || null,
          width: img.width,
          height: img.height,
          mimeType: img.mimeType,
          sectionHeading: img.sectionHeading || null,
        }));

        await prisma.generatedArticleDraft.update({
          where: { id: draft.id },
          data: {
            markdown: finalMarkdown,
            heroImageUrl: hero?.storageUrl || draft.heroImageUrl,
            ogImageUrl: og?.storageUrl || null,
            imagesJson: imagesJson as unknown as import("@prisma/client").Prisma.InputJsonValue,
          },
        });

        await prisma.generatedArticleImage.deleteMany({ where: { draftId: draft.id } });
        for (const img of imagesJson) {
          await prisma.generatedArticleImage.create({
            data: {
              draftId: draft.id,
              kind: img.kind as "HERO" | "OG" | "INLINE",
              prompt: "",
              altText: img.altText,
              caption: img.caption,
              width: img.width,
              height: img.height,
              mimeType: img.mimeType,
              storageUrl: img.storageUrl,
            },
          });
        }

        results.push({ id: draft.id, slug: draft.slug, success: true, imageCount: generatedImages.length });
      } catch (err) {
        results.push({
          id: draft.id,
          slug: draft.slug,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Regenerate All Images] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 500 }
    );
  }
}

/* ── Topic-aware image spec builder ── */

const SCENE_MAP: Record<string, { prompt: string; alt: string; caption: string }> = {
  visa: { prompt: "Exterior of a Cambodian immigration office or border checkpoint, documentary style.", alt: "Cambodia immigration office", caption: "Visa and immigration in Cambodia" },
  border: { prompt: "Travellers queuing at a Cambodia-Thailand or Cambodia-Vietnam land border crossing.", alt: "Border crossing in Cambodia", caption: "A border checkpoint in Cambodia" },
  airport: { prompt: "Phnom Penh or Siem Reap airport terminal, passengers with luggage, bright and modern interior.", alt: "Cambodia airport terminal", caption: "Arriving at a Cambodia airport" },
  flight: { prompt: "Aerial or terminal view of a Cambodian airport with planes on the tarmac.", alt: "Airport in Cambodia", caption: "Flying in and out of Cambodia" },
  transport: { prompt: "A tuk tuk driving through Phnom Penh traffic on a sunny day, passengers visible.", alt: "Tuk tuk ride in Cambodia", caption: "Getting around by tuk tuk" },
  cost: { prompt: "Fresh produce stall at a Cambodian wet market with handwritten price signs.", alt: "Market prices in Cambodia", caption: "Everyday prices at a local market" },
  rent: { prompt: "A modern apartment building exterior in Phnom Penh with balconies and tropical plants.", alt: "Apartments in Phnom Penh", caption: "Typical apartment building" },
  food: { prompt: "A busy Cambodian street food vendor cooking noodles over a flame, steam rising.", alt: "Street food in Cambodia", caption: "Cambodian street food" },
  safety: { prompt: "A well-lit Phnom Penh street at dusk with open shopfronts and evening foot traffic.", alt: "Evening in Phnom Penh", caption: "Evening atmosphere in Cambodia" },
  teach: { prompt: "Inside a bright Cambodian classroom, English vocabulary on whiteboard, students at desks.", alt: "English classroom in Cambodia", caption: "Teaching English in Cambodia" },
  health: { prompt: "A modern private clinic entrance in Phnom Penh, professional and clean exterior.", alt: "Medical clinic in Cambodia", caption: "Healthcare in Cambodia" },
  temple: { prompt: "Golden spires of a Cambodian pagoda against blue sky, ornate traditional architecture.", alt: "Buddhist temple in Cambodia", caption: "A Cambodian pagoda" },
  sim: { prompt: "A mobile phone shop in Cambodia with SIM card advertisements.", alt: "Mobile shop in Cambodia", caption: "Getting connected in Cambodia" },
  bank: { prompt: "ATMs and a bank branch on a Phnom Penh street, clean modern facade.", alt: "Banking in Cambodia", caption: "Financial services in Cambodia" },
  market: { prompt: "Central Market Phnom Penh art-deco dome exterior with vendors outside.", alt: "Central Market, Phnom Penh", caption: "The famous Central Market" },
  expat: { prompt: "A cozy cafe in BKK1 Phnom Penh, expats and locals mixed, laptops and coffee.", alt: "Expat cafe in Phnom Penh", caption: "Expat social life" },
  angkor: { prompt: "Sunrise over Angkor Wat, silhouette of towers reflected in moat.", alt: "Angkor Wat at sunrise", caption: "Sunrise at Angkor Wat" },
  phnom: { prompt: "Phnom Penh riverfront promenade at golden hour, Royal Palace in background.", alt: "Phnom Penh riverfront", caption: "The Phnom Penh riverfront" },
};

function buildDraftImageSpecs(title: string, topic: string, markdown: string): ImageSpec[] {
  const style = "Natural lighting, candid feel, no text overlays, no watermarks, no logos.";
  const noText = "Do not include any text in the image.";
  const headings = extractHeadings(markdown);
  const combined = `${title} ${topic}`.toLowerCase();

  const specs: ImageSpec[] = [];
  const mainScene = findBestScene(combined);

  specs.push({
    kind: "HERO",
    prompt: `Photorealistic travel documentary photograph of Cambodia. Wide landscape shot of ${mainScene.heroDesc}. Relevant to: ${title}. ${style} ${noText}`,
    altText: `Cambodia scene related to ${title.toLowerCase()}`.slice(0, 125),
    width: 1344,
    height: 768,
  });

  specs.push({
    kind: "OG",
    prompt: `Photorealistic cinematic wide shot of Cambodia. ${mainScene.ogDesc}. Relevant to: ${title}. Vibrant but realistic. ${style} ${noText}`,
    altText: `${title} preview image`.slice(0, 125),
    width: 1200,
    height: 630,
  });

  const usedKeys = new Set<string>();
  const inlines: Array<{ heading: string; prompt: string; alt: string; caption: string }> = [];

  for (const heading of headings.slice(0, 10)) {
    if (inlines.length >= 3) break;
    const hLower = `${heading} ${combined}`.toLowerCase();
    for (const [key, scene] of Object.entries(SCENE_MAP)) {
      if (usedKeys.has(key)) continue;
      if (hLower.includes(key)) {
        usedKeys.add(key);
        inlines.push({ heading, prompt: scene.prompt, alt: scene.alt, caption: scene.caption });
        break;
      }
    }
  }

  const fallbackKeys = Object.keys(SCENE_MAP).filter((k) => !usedKeys.has(k));
  for (const key of fallbackKeys) {
    if (inlines.length >= 3) break;
    if (combined.includes(key)) {
      inlines.push({
        heading: headings[Math.min(inlines.length + 1, headings.length - 1)] || "Details",
        ...SCENE_MAP[key],
      });
    }
  }

  const genericFallbacks = ["food", "market", "phnom"];
  for (const key of genericFallbacks) {
    if (inlines.length >= 3) break;
    if (!usedKeys.has(key) && SCENE_MAP[key]) {
      inlines.push({
        heading: headings[Math.min(inlines.length + 1, headings.length - 1)] || "More Info",
        ...SCENE_MAP[key],
      });
      usedKeys.add(key);
    }
  }

  for (const inline of inlines.slice(0, 3)) {
    specs.push({
      kind: "INLINE",
      prompt: `Photorealistic travel documentary photograph of Cambodia. ${inline.prompt} ${style} ${noText}`,
      altText: inline.alt,
      caption: inline.caption,
      width: 1024,
      height: 576,
      sectionHeading: inline.heading,
    });
  }

  return specs;
}

function findBestScene(text: string): { heroDesc: string; ogDesc: string } {
  if (/airport|terminal|kti|pnh|rep|aviation|runway/.test(text)) {
    return { heroDesc: "a modern Cambodian airport terminal building, planes on tarmac, passengers with luggage", ogDesc: "Aerial or exterior view of a Cambodian airport, modern terminal architecture" };
  }
  if (/flight|airline|flying|air route/.test(text)) {
    return { heroDesc: "planes at a Cambodian airport terminal, passengers boarding, bright modern interior", ogDesc: "Airport departure board and terminal in Cambodia" };
  }
  if (/visa|entry|border|passport|e-visa|immigration/.test(text)) {
    return { heroDesc: "a Cambodia border checkpoint or immigration hall with travellers", ogDesc: "Travellers at a Cambodian airport or border, documentary feel" };
  }
  if (/cost|price|budget|salary|living/.test(text)) {
    return { heroDesc: "a vibrant Cambodian market with colourful produce and price tags", ogDesc: "A busy Cambodian market scene, everyday items and prices" };
  }
  if (/teach|school|class|english|tefl/.test(text)) {
    return { heroDesc: "a bright modern classroom in Cambodia with a whiteboard and student desks", ogDesc: "An English classroom in Cambodia, warm natural light" };
  }
  if (/health|hospital|clinic|medical/.test(text)) {
    return { heroDesc: "a modern Cambodian hospital or clinic entrance", ogDesc: "Healthcare facility in Cambodia, clean and modern" };
  }
  if (/safety|crime|scam|safe/.test(text)) {
    return { heroDesc: "a well-lit Phnom Penh street at night with open shopfronts and evening strollers", ogDesc: "Safe, busy Cambodia evening street scene" };
  }
  if (/rent|apartment|housing/.test(text)) {
    return { heroDesc: "a modern apartment building in Phnom Penh BKK1 area", ogDesc: "Residential buildings in a popular Phnom Penh neighbourhood" };
  }
  if (/transport|tuk|bus|grab/.test(text)) {
    return { heroDesc: "a tuk tuk navigating busy Phnom Penh traffic", ogDesc: "Transport scene in Cambodia, tuk tuks and motorbikes" };
  }
  if (/angkor|siem reap|temple/.test(text)) {
    return { heroDesc: "Angkor Wat towers at golden hour", ogDesc: "Angkor temples at golden hour, dramatic sky" };
  }
  return { heroDesc: "a wide panoramic view of the Phnom Penh skyline from the riverfront at golden hour", ogDesc: "Cambodia panorama, warm golden light" };
}
