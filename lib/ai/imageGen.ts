/**
 * Image generation and storage for the AI Blog Generator.
 *
 * Uses Imagen 3 via the Gemini API for photorealistic image generation
 * and Vercel Blob for persistent storage.
 *
 * Each article gets:
 *   1 HERO image  (landscape ~16:9, 1344x768)
 *   1 OG image    (1200x630 for social sharing)
 *   3 INLINE images (landscape, tied to specific sections)
 */

import { put } from "@vercel/blob";
import { validateGeminiKey } from "@/lib/ai/geminiClient";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

export interface ImageSpec {
  kind: "HERO" | "OG" | "INLINE";
  prompt: string;
  altText: string;
  caption?: string;
  width: number;
  height: number;
  /** Section heading this image should appear after (INLINE only) */
  sectionHeading?: string;
}

export interface GeneratedImage extends ImageSpec {
  storageUrl: string;
  mimeType: string;
}

/**
 * Build image specs for an article.
 */
export function buildImageSpecs(
  city: string,
  topic: string,
  title: string,
  sectionHeadings: string[]
): ImageSpec[] {
  const base = `Photorealistic travel documentary photograph of ${city}, Cambodia.`;
  const style = "Natural lighting, candid feel, no text overlays, no watermarks, no logos.";
  const emDashNote = "Do not include any text in the image.";

  const specs: ImageSpec[] = [];

  // HERO image
  specs.push({
    kind: "HERO",
    prompt: `${base} Wide landscape shot of a ${city} street scene or landmark relevant to daily life and ${topic.toLowerCase()}. Focus on architecture, streets, and atmosphere. ${style} ${emDashNote}`,
    altText: `${city} scene related to ${topic.toLowerCase()}`,
    width: 1344,
    height: 768,
  });

  // OG image (standard social sharing dimensions)
  specs.push({
    kind: "OG",
    prompt: `${base} Cinematic wide shot for social media preview about ${topic.toLowerCase()}. Vibrant but realistic colors. ${style} ${emDashNote}`,
    altText: `${title} preview image`,
    width: 1200,
    height: 630,
  });

  // INLINE images tied to sections
  const sectionTopics = pickInlineSections(sectionHeadings, topic, city);
  for (const sec of sectionTopics) {
    specs.push({
      kind: "INLINE",
      prompt: `${base} ${sec.prompt} ${style} ${emDashNote}`,
      altText: sec.altText,
      caption: sec.caption,
      width: 1024,
      height: 576,
      sectionHeading: sec.heading,
    });
  }

  return specs;
}

/**
 * Pick 3 article sections that benefit from images.
 */
function pickInlineSections(
  headings: string[],
  topic: string,
  city: string
): Array<{ heading: string; prompt: string; altText: string; caption?: string }> {
  const sectionMap: Record<string, { prompt: string; altText: string; caption?: string }> = {
    cost: {
      prompt: `A local market stall with fresh produce and price tags visible, showing everyday shopping in ${city}.`,
      altText: `Local market stall with prices in ${city}`,
      caption: `Everyday prices at a ${city} market`,
    },
    rent: {
      prompt: `Modern apartment building exterior in ${city}, clean architecture, balconies, tropical plants. Welcoming and well-maintained.`,
      altText: `Apartment building in ${city}`,
      caption: `Typical apartment building in ${city}`,
    },
    food: {
      prompt: `A busy local restaurant or street food vendor in ${city}. Steaming dishes, casual dining atmosphere.`,
      altText: `Street food dining in ${city}`,
      caption: `Casual dining scene in ${city}`,
    },
    transport: {
      prompt: `Tuk tuk or motorbike taxi on a busy ${city} street. Normal traffic flow and daily commuting.`,
      altText: `Daily transport scene in ${city}`,
      caption: `Getting around ${city} by tuk tuk`,
    },
    safety: {
      prompt: `A well-lit ${city} street at dusk. Warm streetlights, open shopfronts, motorbikes parked, safe and lively evening atmosphere.`,
      altText: `Evening street scene in ${city}`,
      caption: `Evening atmosphere in ${city}`,
    },
    visa: {
      prompt: `Exterior of a government building or immigration office area in ${city}. Professional, documentary style.`,
      altText: `Administrative area in ${city}`,
    },
    teach: {
      prompt: `A bright, modern classroom interior in ${city}. Whiteboard with English vocabulary, desks, colorful walls, natural light from windows.`,
      altText: `English classroom in ${city}`,
      caption: `A classroom setup in ${city}`,
    },
    health: {
      prompt: `Modern clinic or hospital entrance in ${city}. Clean, professional, reassuring exterior.`,
      altText: `Healthcare facility in ${city}`,
    },
    neighbourhood: {
      prompt: `A peaceful residential street in a popular expat area of ${city}. Tree-lined, with small cafes visible.`,
      altText: `Expat neighbourhood in ${city}`,
      caption: `A quiet expat-friendly neighbourhood in ${city}`,
    },
    daily: {
      prompt: `A cozy cafe interior in ${city}. Natural light, coffee cups, laptop on a wooden table, plants, relaxed atmosphere.`,
      altText: `Cafe in ${city}`,
      caption: `A typical cafe in ${city}`,
    },
  };

  const results: Array<{ heading: string; prompt: string; altText: string; caption?: string }> = [];
  const usedKeys = new Set<string>();

  // Match headings to section topics
  for (const heading of headings) {
    if (results.length >= 3) break;
    const lower = heading.toLowerCase();
    for (const [key, data] of Object.entries(sectionMap)) {
      if (usedKeys.has(key)) continue;
      if (lower.includes(key)) {
        results.push({ heading, ...data });
        usedKeys.add(key);
        break;
      }
    }
  }

  // Fill remaining slots with topic-based defaults
  const topicLower = topic.toLowerCase();
  const fallbackKeys = Object.keys(sectionMap).filter((k) => !usedKeys.has(k));
  for (const key of fallbackKeys) {
    if (results.length >= 3) break;
    if (topicLower.includes(key) || key === "food" || key === "daily") {
      results.push({
        heading: headings[Math.min(results.length + 1, headings.length - 1)] || "Daily Life",
        ...sectionMap[key],
      });
      usedKeys.add(key);
    }
  }

  // If still short, just pick remaining keys
  for (const key of fallbackKeys) {
    if (results.length >= 3) break;
    if (!usedKeys.has(key)) {
      results.push({
        heading: headings[Math.min(results.length + 1, headings.length - 1)] || "Daily Life",
        ...sectionMap[key],
      });
      usedKeys.add(key);
    }
  }

  return results.slice(0, 3);
}

/**
 * Generate a single image using Imagen 3 via the Gemini API.
 * Returns base64 image data and mime type.
 */
async function generateImageWithImagen(
  prompt: string
): Promise<{ base64: string; mimeType: string }> {
  const apiKey = validateGeminiKey();
  const url = `${GEMINI_API_BASE}/models/${IMAGEN_MODEL}:predict?key=${apiKey}`;

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: "16:9",
      personGeneration: "ALLOW_ADULT",
      safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // If Imagen is not available, fall back gracefully
    console.error(`[Imagen] API error (${response.status}): ${errorText}`);
    throw new Error(`Image generation failed (${response.status})`);
  }

  const data = await response.json();
  const prediction = data.predictions?.[0];

  if (!prediction?.bytesBase64Encoded) {
    const reason = prediction?.safetyAttributes?.blocked
      ? `Safety filter blocked (categories: ${JSON.stringify(prediction.safetyAttributes)})`
      : "No image data in response";
    console.error(`[Imagen] Empty prediction: ${reason}`);
    throw new Error(`Imagen returned no image data. ${reason}`);
  }

  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType || "image/png",
  };
}

/**
 * Upload an image to Vercel Blob storage.
 */
async function uploadToBlob(
  base64: string,
  mimeType: string,
  filename: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const path = `blog-images/${filename}.${ext}`;

  const blob = await put(path, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: true,
  });

  return blob.url;
}

/**
 * Generate all images for an article and upload to Vercel Blob.
 * Returns generated images with storage URLs.
 * Failures are logged but don't block the pipeline.
 */
export async function generateAndUploadImages(
  specs: ImageSpec[],
  slugPrefix: string
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  for (const spec of specs) {
    try {
      const { base64, mimeType } = await generateImageWithImagen(spec.prompt);
      const filename = `${slugPrefix}-${spec.kind.toLowerCase()}-${Date.now()}`;
      const storageUrl = await uploadToBlob(base64, mimeType, filename);

      results.push({
        ...spec,
        storageUrl,
        mimeType,
      });
    } catch (error) {
      console.error(
        `[ImageGen] Failed to generate ${spec.kind} image:`,
        error instanceof Error ? error.message : error
      );
      // Continue with other images, don't break the pipeline
    }
  }

  return results;
}

/**
 * Inject image markdown into the article body.
 * HERO goes at the very top. INLINE images go after their target section heading.
 */
export function injectImagesIntoMarkdown(
  markdown: string,
  images: GeneratedImage[]
): string {
  let result = markdown;

  // Find the hero image
  const hero = images.find((img) => img.kind === "HERO");

  // Insert hero image right after the first H1 heading
  if (hero) {
    const h1Match = result.match(/^(# .+)$/m);
    if (h1Match) {
      const heroMd = `\n\n![${hero.altText}](${hero.storageUrl})\n`;
      result = result.replace(h1Match[0], `${h1Match[0]}${heroMd}`);
    }
  }

  // Insert inline images after their section headings
  const inlineImages = images.filter((img) => img.kind === "INLINE" && img.sectionHeading);
  for (const img of inlineImages) {
    const escapedHeading = img.sectionHeading!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingPattern = new RegExp(`^(## ${escapedHeading}.*)$`, "m");
    const match = result.match(headingPattern);
    if (match) {
      const captionLine = img.caption ? `\n*${img.caption}*` : "";
      const imgMd = `\n\n![${img.altText}](${img.storageUrl})${captionLine}\n`;
      result = result.replace(match[0], `${match[0]}${imgMd}`);
    }
  }

  return result;
}

/**
 * Extract H2 headings from markdown.
 */
export function extractHeadings(markdown: string): string[] {
  const matches = markdown.matchAll(/^## (.+)$/gm);
  return Array.from(matches, (m) => m[1].trim());
}
