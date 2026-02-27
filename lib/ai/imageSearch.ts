/**
 * Hybrid image sourcing for the AI Blog Generator.
 *
 * Articles about specific real places/landmarks get real photos from
 * Google Images (via Serper). Generic topics get AI-generated images
 * via Imagen. Gaps are always filled with AI-generated fallbacks.
 *
 * Credit usage: typically 1 Serper credit per article (one image search
 * covers HERO + OG + up to 3 INLINE from the same result pool).
 */

import { put } from "@vercel/blob";
import { callGeminiText } from "@/lib/ai/geminiClient";
import {
  generateAndUploadImages,
  type ImageSpec,
  type GeneratedImage,
} from "@/lib/ai/imageGen";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface ImageStrategy {
  useRealImages: boolean;
  heroQuery: string;
  ogQuery: string;
  inlineQueries: string[];
}

interface SerperImage {
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  thumbnailUrl: string;
  source: string;
}

/* ------------------------------------------------------------------ */
/*  1. Classify: real photos vs AI-generated                            */
/* ------------------------------------------------------------------ */

/**
 * Ask Gemini whether the article title refers to a specific,
 * photographable real-world place or a generic concept.
 */
async function classifyImageStrategy(title: string): Promise<ImageStrategy> {
  const prompt = `Classify this blog article title. Should we use real Google Images photos or AI-generated images?

Title: "${title}"

REAL photos: title is about a SPECIFIC photographable place, building, landmark, airport, temple, hotel, restaurant, or named venue.
AI-generated: title is about a GENERIC concept (cost of living, teaching, transport, safety, visas, how-to, neighbourhood overviews).

City names alone (Phnom Penh, Siem Reap) are NOT specific enough. The article must focus on a concrete named venue/landmark.

REAL examples: "New KTI Airport", "Angkor Wat Guide", "Royal Palace Phnom Penh", "AEON Mall Cambodia", "Koh Rong Beach"
AI examples: "Cost of Living in Cambodia", "Teaching English in Phnom Penh", "Is Cambodia Safe?", "Transport in Phnom Penh"

Return ONLY JSON (no markdown fences):
{"useRealImages":true/false,"heroQuery":"Google Images search query for hero","ogQuery":"different angle query for OG","inlineQueries":["q1","q2","q3"]}`;

  try {
    const response = await callGeminiText(prompt);
    // Parse with basic cleanup
    const cleaned = response.text
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const json = JSON.parse(cleaned);

    return {
      useRealImages: !!json.useRealImages,
      heroQuery: (json.heroQuery as string) || title,
      ogQuery: (json.ogQuery as string) || title,
      inlineQueries: Array.isArray(json.inlineQueries)
        ? (json.inlineQueries as string[]).slice(0, 3)
        : [title],
    };
  } catch (err) {
    console.error("[ImageSearch] Classification failed, defaulting to AI:", err);
    return {
      useRealImages: false,
      heroQuery: title,
      ogQuery: title,
      inlineQueries: [title],
    };
  }
}

/* ------------------------------------------------------------------ */
/*  2. Serper Images API                                                */
/* ------------------------------------------------------------------ */

async function searchSerperImages(
  query: string,
  count: number = 10
): Promise<SerperImage[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: count }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`Serper Images ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    return (data.images as SerperImage[]) || [];
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  3. Download image → Vercel Blob                                     */
/* ------------------------------------------------------------------ */

/** Image extensions we trust even when the server sends wrong content-type */
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)(\?|$)/i;

function resolveImageMimeType(ct: string, url: string): string | null {
  if (ct.startsWith("image/")) return ct;
  if (IMAGE_EXT_RE.test(url)) {
    if (/\.jpe?g/i.test(url)) return "image/jpeg";
    if (/\.png/i.test(url)) return "image/png";
    if (/\.webp/i.test(url)) return "image/webp";
    if (/\.gif/i.test(url)) return "image/gif";
    return "image/jpeg";
  }
  if (ct === "application/octet-stream") return "image/jpeg";
  return null;
}

async function downloadAndUploadImage(
  imageUrl: string,
  filename: string
): Promise<{ url: string; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const resp = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "GlobescraperBot/1.0 (+https://globescraper.com)",
        Accept: "image/*",
      },
    });

    clearTimeout(timer);

    if (!resp.ok) return null;

    const ct = resp.headers.get("content-type") || "";
    const mimeType = resolveImageMimeType(ct, imageUrl);
    if (!mimeType) return null;

    const buf = Buffer.from(await resp.arrayBuffer());

    // Skip tiny images (likely thumbnails, icons, or tracking pixels)
    if (buf.byteLength < 10_000) return null;

    const ext =
      mimeType.includes("jpeg") || mimeType.includes("jpg")
        ? "jpg"
        : mimeType.includes("webp")
          ? "webp"
          : "png";
    const blob = await put(`blog-images/${filename}.${ext}`, buf, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true,
    });

    return { url: blob.url, mimeType };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  4. Pick best image from search results                              */
/* ------------------------------------------------------------------ */

function pickBestImage(
  images: SerperImage[],
  targetW: number,
  targetH: number,
  excludeUrls: Set<string>
): SerperImage | null {
  const targetRatio = targetW / targetH;

  const scored = images
    .filter((i) => !excludeUrls.has(i.imageUrl))
    .filter((i) => i.imageWidth >= 400 && i.imageHeight >= 250)
    .map((i) => {
      const ratio = i.imageWidth / i.imageHeight;
      const ratioDiff = Math.abs(ratio - targetRatio);
      const sizeScore = Math.min(i.imageWidth / targetW, 1);
      // Prefer landscape, large, close-to-target-ratio images
      return { img: i, score: sizeScore - ratioDiff * 0.5 };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.img ?? null;
}

/* ------------------------------------------------------------------ */
/*  5. Fetch, pick, download, upload real images                        */
/* ------------------------------------------------------------------ */

async function fetchRealImages(
  specs: ImageSpec[],
  strategy: ImageStrategy,
  slugPrefix: string
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];
  const usedUrls = new Set<string>();

  // One main search covering hero + OG + maybe inlines (saves credits)
  const mainPool = await searchSerperImages(strategy.heroQuery, 20);

  // ── Hero and OG ──
  for (const spec of specs.filter(
    (s) => s.kind === "HERO" || s.kind === "OG"
  )) {
    const best = pickBestImage(mainPool, spec.width, spec.height, usedUrls);
    if (!best) continue;
    usedUrls.add(best.imageUrl);

    const fn = `${slugPrefix}-${spec.kind.toLowerCase()}-real-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const uploaded = await downloadAndUploadImage(best.imageUrl, fn);
    if (!uploaded) continue;

    results.push({
      ...spec,
      storageUrl: uploaded.url,
      mimeType: uploaded.mimeType,
    });
  }

  // ── Inline images — use main pool first, search more only if needed ──
  const inlineSpecs = specs.filter((s) => s.kind === "INLINE");
  for (let i = 0; i < inlineSpecs.length; i++) {
    const spec = inlineSpecs[i];

    // Try main pool first
    let best = pickBestImage(mainPool, spec.width, spec.height, usedUrls);

    // If not enough unique images in main pool, do a targeted search
    if (!best && strategy.inlineQueries[i]) {
      try {
        const extra = await searchSerperImages(
          strategy.inlineQueries[i],
          10
        );
        best = pickBestImage(extra, spec.width, spec.height, usedUrls);
      } catch (err) {
        console.warn(`[ImageSearch] Inline search failed:`, err);
      }
    }

    if (!best) continue;
    usedUrls.add(best.imageUrl);

    const fn = `${slugPrefix}-inline-real-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const uploaded = await downloadAndUploadImage(best.imageUrl, fn);
    if (!uploaded) continue;

    results.push({
      ...spec,
      storageUrl: uploaded.url,
      mimeType: uploaded.mimeType,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  6. Main entry point: hybrid image generation                        */
/* ------------------------------------------------------------------ */

/**
 * Generate images for an article using a hybrid strategy:
 *   • Real places  → Google Images via Serper (downloaded to Vercel Blob)
 *   • Generic topics → AI-generated via Imagen
 *   • Any gaps are always filled with AI-generated fallbacks
 */
export async function generateHybridImages(
  articleTitle: string,
  specs: ImageSpec[],
  slugPrefix: string
): Promise<GeneratedImage[]> {
  // 1. Classify the topic
  const strategy = await classifyImageStrategy(articleTitle);

  if (!strategy.useRealImages) {
    console.log(
      `[HybridImage] AI-generated images for: "${articleTitle}"`
    );
    return generateAndUploadImages(specs, slugPrefix);
  }

  console.log(
    `[HybridImage] Real images for: "${articleTitle}" (query: "${strategy.heroQuery}")`
  );

  // 2. Fetch real images
  let images: GeneratedImage[];
  try {
    images = await fetchRealImages(specs, strategy, slugPrefix);
  } catch (err) {
    console.error(
      "[HybridImage] Real image search failed, falling back to AI:",
      err
    );
    return generateAndUploadImages(specs, slugPrefix);
  }

  // 3. Fill gaps with AI-generated images
  const coveredKeys = new Set(
    images.map((img) => `${img.kind}:${img.sectionHeading || ""}`)
  );
  const missingSpecs = specs.filter(
    (s) => !coveredKeys.has(`${s.kind}:${s.sectionHeading || ""}`)
  );

  if (missingSpecs.length > 0) {
    console.log(
      `[HybridImage] Filling ${missingSpecs.length} gaps with AI-generated images`
    );
    try {
      const aiImages = await generateAndUploadImages(missingSpecs, slugPrefix);
      images.push(...aiImages);
    } catch (err) {
      console.error("[HybridImage] AI fallback also failed:", err);
    }
  }

  return images;
}
