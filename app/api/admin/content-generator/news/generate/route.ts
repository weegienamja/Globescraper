import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNewsGenRatelimit } from "@/lib/rate-limit";
import {
  validateGeminiKey,
  callGemini,
  callGeminiText,
  parseGeminiJson,
} from "@/lib/ai/geminiClient";
import { isAllowedByRobots } from "@/lib/robots/robotsCheck";
import { fetchPage } from "@/lib/scrape/fetchPage";
import { extractMainText, extractTitle } from "@/lib/scrape/extractMainText";
import { buildExistingContentDigest } from "@/lib/scrape/contentDiscovery";
import {
  findTrustedSource,
  isOfficialSource,
  isBlockedDomain,
  getPublisherName,
  topicRequiresOfficialSource,
  NEWS_SOURCE_REGISTRY,
} from "@/lib/newsSourcePolicy";
import {
  generateAndUploadImages,
  injectImagesIntoMarkdown,
  extractHeadings,
  type ImageSpec,
  type GeneratedImage,
} from "@/lib/ai/imageGen";
import type {
  NewsArticleData,
  AudienceFit,
  NewsBullet,
  FetchedSource,
} from "@/lib/newsTopicTypes";

export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/*  Banned words and style rules (shared with main generator)           */
/* ------------------------------------------------------------------ */

const BANNED_WORDS = [
  "accordingly", "moreover", "robust", "vibrant", "innovative",
  "furthermore", "consequently", "nevertheless", "notwithstanding",
  "henceforth", "utilize", "leverage", "synergy", "paradigm",
  "holistic", "streamline", "cutting-edge", "game-changer",
  "ecosystem", "deep dive",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Strip em dashes from a string. */
function stripEmDashes(s: string): string {
  return s.replace(/\u2014/g, ", ").replace(/\u2013/g, ", ");
}

/** Check if text contains em dashes. */
function hasEmDash(s: string): boolean {
  return /[\u2014\u2013]/.test(s);
}

/* ------------------------------------------------------------------ */
/*  1. Source validation and expansion                                  */
/* ------------------------------------------------------------------ */

async function validateAndExpandSources(
  seedUrls: string[],
  topicTitle: string,
  angle: string
): Promise<FetchedSource[]> {
  const seenUrls = new Set<string>();

  // Start with seed URLs
  const candidateUrls = [...seedUrls];

  // Add extra discovery based on topic keywords
  for (const reg of NEWS_SOURCE_REGISTRY) {
    if (candidateUrls.length >= 10) break;
    if (reg.category === "LOCAL_NEWS" || reg.category === "OFFICIAL_GOV") {
      candidateUrls.push(`https://www.${reg.domain}`);
    }
  }

  // De-duplicate candidates
  const uniqueUrls: string[] = [];
  for (const url of candidateUrls) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    if (isBlockedDomain(url)) continue;
    uniqueUrls.push(url);
  }

  // Check if topic requires official sources
  const needsOfficial = topicRequiresOfficialSource(topicTitle);

  // ── Parallel fetch with a global 45-second timeout ──
  const SOURCE_PHASE_TIMEOUT_MS = 45_000;

  const fetchOne = async (url: string): Promise<FetchedSource | null> => {
    try {
      const allowed = await isAllowedByRobots(url);
      if (!allowed) {
        console.log(`[News Gen] Skipping ${url}: blocked by robots.txt`);
        return null;
      }
      const html = await fetchPage(url);
      if (!html) return null;

      const text = extractMainText(html);
      if (text.length < 100) return null;

      const title = extractTitle(html);
      return {
        url,
        title,
        publisher: getPublisherName(url),
        text,
        fetchedAt: new Date(),
        isOfficial: isOfficialSource(url),
      };
    } catch {
      return null;
    }
  };

  // Race all fetches against the global timeout
  const results = await Promise.race([
    Promise.allSettled(uniqueUrls.map(fetchOne)),
    new Promise<PromiseSettledResult<FetchedSource | null>[]>((resolve) =>
      setTimeout(() => {
        console.warn(`[News Gen] Source fetch phase hit ${SOURCE_PHASE_TIMEOUT_MS / 1000}s timeout`);
        resolve([]);
      }, SOURCE_PHASE_TIMEOUT_MS)
    ),
  ]);

  const sources: FetchedSource[] = [];
  for (const r of results) {
    if (sources.length >= 8) break;
    if (r.status === "fulfilled" && r.value) {
      sources.push(r.value);
    }
  }

  if (needsOfficial && !sources.some((s) => s.isOfficial)) {
    console.warn(`[News Gen] Topic "${topicTitle}" should have official sources but none were accessible.`);
  }

  if (sources.length === 0) {
    console.warn(`[News Gen] All ${seedUrls.length} seed URLs failed to fetch. Article will use seed URLs as references.`);
  }

  return sources;
}

/* ------------------------------------------------------------------ */
/*  2. Build facts pack                                                 */
/* ------------------------------------------------------------------ */

function buildNewsFactsPack(
  sources: FetchedSource[],
  topicTitle: string,
  angle: string,
  audienceFit: AudienceFit[],
  targetKeyword: string,
  secondaryKeywords: string[]
): { bullets: NewsBullet[]; bulletText: string; officialCount: number } {
  const bullets: NewsBullet[] = [];

  for (const source of sources) {
    // Extract key sentences as facts
    const sentences = source.text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30 && s.length < 200);

    // Filter for fact-bearing sentences
    const factful = sentences.filter(
      (s) =>
        /\d/.test(s) ||
        /new|change|update|announce|rule|require|allow|ban|open|close/i.test(s) ||
        /visa|permit|border|entry|safety|health|cost|price|teach|school/i.test(s)
    );

    const selected = (factful.length > 0 ? factful : sentences).slice(0, 8);

    for (const sentence of selected) {
      // Max 20 words of direct quote, so we paraphrase-truncate
      const words = sentence.split(/\s+/);
      const shortFact = words.length > 20 ? words.slice(0, 18).join(" ") + "..." : sentence;

      bullets.push({
        fact: shortFact,
        sourceUrl: source.url,
        publisher: source.publisher,
        isOfficial: source.isOfficial,
      });
    }
  }

  const officialCount = sources.filter((s) => s.isOfficial).length;

  const bulletText = bullets
    .map((b) => `- ${b.fact} [Source: ${b.publisher}, ${b.sourceUrl}]${b.isOfficial ? " (OFFICIAL)" : ""}`)
    .join("\n");

  return { bullets, bulletText, officialCount };
}

/* ------------------------------------------------------------------ */
/*  3. Competitor / duplication check                                   */
/* ------------------------------------------------------------------ */

async function checkForDuplicates(topicTitle: string): Promise<string> {
  const { articles, promptSection } = await buildExistingContentDigest();

  if (articles.length === 0) return "";

  // Check for similar topics
  const topicLower = topicTitle.toLowerCase();
  const similar = articles.filter((a) => {
    const titleLower = a.title.toLowerCase();
    const descLower = a.description.toLowerCase();
    // Check keyword overlap
    const keywords = topicLower.split(/\s+/).filter((w) => w.length > 3);
    const matchCount = keywords.filter(
      (kw) => titleLower.includes(kw) || descLower.includes(kw)
    ).length;
    return matchCount >= 2;
  });

  if (similar.length === 0) return promptSection;

  return `${promptSection}

WARNING: These existing articles have similar topics. You MUST take a clearly different angle:
${similar.map((a) => `- "${a.title}" (/${a.slug})`).join("\n")}
Differentiate by focusing on the NEWS angle: what specifically changed, when, and practical implications.`;
}

/* ------------------------------------------------------------------ */
/*  4. Gemini news article generation prompt                            */
/* ------------------------------------------------------------------ */

function buildNewsGenerationPrompt(
  topicTitle: string,
  angle: string,
  audienceFit: AudienceFit[],
  targetKeyword: string,
  secondaryKeywords: string[],
  bulletText: string,
  officialSourceCount: number,
  sourceCount: number,
  existingContentPrompt: string,
  seedUrls: string[] = []
): string {
  // Build a fallback section from seed URLs when no bullet text is available
  const seedUrlsSection = seedUrls.length > 0
    ? `No page content could be fetched, but these source URLs were identified during topic discovery. Reference them in your sources array and write about the topic using your training knowledge:\n${seedUrls.map((u) => `- ${u}`).join("\n")}`
    : "";
  const monthYear = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const audienceDesc = audienceFit.includes("TRAVELLERS") && audienceFit.includes("TEACHERS")
    ? "both travellers to Cambodia and English teachers living or planning to live there"
    : audienceFit.includes("TRAVELLERS")
      ? "travellers to Cambodia"
      : "English teachers in Cambodia";

  return `You are a professional news and travel content writer for GlobeScraper, a website about moving to and visiting Cambodia.

Write an in-depth news-based blog post about: "${topicTitle}"
Angle: ${angle}
Target audience: ${audienceDesc}
Primary keyword: ${targetKeyword}
Secondary keywords: ${secondaryKeywords.join(", ")}
Date: ${monthYear}

STRICT STYLE RULES:
1. NEVER use em dashes anywhere. Not in titles, headings, body text, FAQs, meta descriptions, alt text, captions, or any part of the output. Use commas, periods, colons, or semicolons instead.
2. Write in active voice. Avoid passive constructions.
3. Use short sentences. Most sentences should be under 20 words.
4. Use short paragraphs. Maximum 3 sentences per paragraph.
5. Use frequent line breaks between paragraphs.
6. Use bullet points and numbered lists often.
7. If including a table, keep it to 2-3 columns max with short headers for mobile readability. Prefer lists over tables when possible.
8. Write in a direct, conversational tone. No corporate speak.
8. Never use these banned words: ${BANNED_WORDS.join(", ")}.
9. Only paraphrase and summarize from sources. Never copy text verbatim.
10. Be honest about downsides. Do not oversell.
11. Use "you" and "your" to address the reader directly.
12. Must be fun and readable without being cringe.
13. Humanize with realistic scenarios without claiming personal experience as fact.
   Acceptable: "You land late. You want a SIM fast. Here is what changed and what to do."
   Not acceptable: "When I went last month, I did X."
14. No text in alt text or captions should contain em dashes.

RESEARCH DATA (paraphrase only, never copy):
${bulletText || seedUrlsSection || "No research data available. Write based on your training knowledge but mark confidence LOW."}

${existingContentPrompt}

ARTICLE STRUCTURE (follow this exact order):
1. H1 title (# ...)
2. Short intro (2-3 sentences): what changed and why you should care. Include target keyword in first 100 words.
3. "## Quick Take" section with 5-7 bullet points.
4. 5-8 H2 sections covering the topic thoroughly.
5. "## What This Means for Travellers" section with practical advice.
6. "## What This Means for Teachers" section with practical advice.
7. "## What to Do Now" checklist (numbered list of concrete actions).
8. "## Common Mistakes" section with specific scenarios.
9. "## FAQ" section with 5 questions and answers.
10. "## Related Guides" section with 5 internal links.
11. "## Sources" section listing all source URLs as clickable markdown links.

FAQ format:
- Each question on its own line as bold text.
- Answer on the next line, 2-3 sentences.
- No "Q:" or "A:" prefixes.
- No em dashes.

SEO REQUIREMENTS:
- Meta title under 60 characters.
- Meta description 140-160 characters.
- Target keyword in first 100 words.
- Avoid repeating the exact keyword in multiple headings.
- Use natural language.

DO NOT include any image markdown (![...](...)) in the output. Images are generated separately.

OUTPUT FORMAT:
Return a single JSON object:
{
  "title": "H1 title (no em dashes)",
  "slug": "url-friendly-slug",
  "metaTitle": "SEO title under 60 chars (no em dashes)",
  "metaDescription": "140-160 chars (no em dashes)",
  "markdown": "Full article in Markdown",
  "faq": [{"q": "Question?", "a": "Answer."}],
  "internalLinks": [{"title": "Guide title", "slug": "/guide-slug"}],
  "sources": [{"title": "Source title", "url": "https://...", "publisher": "Publisher Name"}],
  "confidenceLevel": "${sourceCount >= 3 ? "HIGH" : "LOW"}",
  "contentType": "NEWS"
}

IMPORTANT:
- No em dashes anywhere. Zero. Check every field.
- Return ONLY the JSON object. No markdown code fences.
- Ensure valid JSON.
- Set confidenceLevel to "LOW" if fewer than 3 sources had usable data.
- Sources array MUST include all sources used. Every claim should be traceable.
- The Sources section in markdown MUST list clickable URLs.
`.trim();
}

/* ------------------------------------------------------------------ */
/*  5. Humanization prompt                                              */
/* ------------------------------------------------------------------ */

function buildNewsHumanizationPrompt(markdown: string): string {
  return `You are an expert editorial rewriter. Rewrite this news article to read like a sharp human journalist wrote it.

${markdown}

RULES:
1. NEVER use em dashes. Replace every em dash with a comma, period, colon, or semicolon.
2. Vary sentence length. Mix short punchy with medium.
3. Keep all facts, numbers, sources, URLs, and structure exactly the same.
4. Keep all Markdown formatting exactly the same.
5. Remove any image markdown lines (![...](...)) entirely.
6. Never use: ${BANNED_WORDS.join(", ")}.
7. Keep word count within 5% of original.
8. Preserve the Sources section with all URLs intact.
9. Do not add new facts or claims.

Return ONLY the rewritten Markdown. No JSON. No code fences.`.trim();
}

/* ------------------------------------------------------------------ */
/*  6. News-specific image specs                                        */
/* ------------------------------------------------------------------ */

function buildNewsImageSpecs(
  topicTitle: string,
  markdown: string
): ImageSpec[] {
  const style = "Natural lighting, candid feel, no text overlays, no watermarks, no logos.";
  const noText = "Do not include any text in the image.";
  const headings = extractHeadings(markdown);

  const specs: ImageSpec[] = [];

  // HERO image
  specs.push({
    kind: "HERO",
    prompt: `Photorealistic travel documentary photograph of Cambodia. Wide landscape shot relevant to: ${topicTitle}. Showing real places and daily life. ${style} ${noText}`,
    altText: stripEmDashes(`Cambodia scene related to ${topicTitle.toLowerCase()}`),
    width: 1344,
    height: 768,
  });

  // OG image
  specs.push({
    kind: "OG",
    prompt: `Photorealistic cinematic wide shot of Cambodia for social media preview about: ${topicTitle}. Vibrant but realistic. ${style} ${noText}`,
    altText: stripEmDashes(`${topicTitle} preview image`),
    width: 1200,
    height: 630,
  });

  // 3 INLINE images after specific sections
  const targetSections = [
    "What This Means for Travellers",
    "What This Means for Teachers",
    "What to Do Now",
  ];

  const inlinePrompts = [
    `Travellers at a Cambodia airport or border checkpoint. Documentary style. ${style} ${noText}`,
    `English teacher in a bright Cambodia classroom. Whiteboard visible, natural setting. ${style} ${noText}`,
    `Person using a phone or laptop in a Cambodia cafe, planning and organizing. Natural Setting. ${style} ${noText}`,
  ];

  const inlineAlts = [
    "Travellers at a Cambodia checkpoint",
    "English classroom in Cambodia",
    "Planning in a Cambodia cafe",
  ];

  const inlineCaptions = [
    "Arrival and border processes in Cambodia",
    "A classroom setup in Cambodia",
    "Getting organized in Cambodia",
  ];

  for (let i = 0; i < 3; i++) {
    // Find the target heading in the actual article headings
    const matchedHeading = headings.find(
      (h) => h.toLowerCase().includes(targetSections[i].toLowerCase().slice(0, 20))
    );

    specs.push({
      kind: "INLINE",
      prompt: `Photorealistic travel documentary photograph of Cambodia. ${inlinePrompts[i]}`,
      altText: stripEmDashes(inlineAlts[i]),
      caption: stripEmDashes(inlineCaptions[i]),
      width: 1024,
      height: 576,
      sectionHeading: matchedHeading || targetSections[i],
    });
  }

  return specs;
}

/* ------------------------------------------------------------------ */
/*  7. Validate news article JSON                                       */
/* ------------------------------------------------------------------ */

function validateNewsArticle(data: Record<string, unknown>): NewsArticleData {
  const required = ["title", "slug", "metaTitle", "metaDescription", "markdown"];
  for (const field of required) {
    if (!data[field] || typeof data[field] !== "string") {
      throw new Error(`Generated news article missing required field: ${field}`);
    }
  }

  // Strip em dashes from all text fields
  const textFields = ["title", "slug", "metaTitle", "metaDescription", "markdown"];
  for (const field of textFields) {
    if (typeof data[field] === "string" && hasEmDash(data[field] as string)) {
      (data as Record<string, string>)[field] = stripEmDashes(data[field] as string);
    }
  }

  // Validate sources exist (warn but don't fail; fallback sources will be injected by caller)
  const sources = Array.isArray(data.sources) ? data.sources : [];
  if (sources.length === 0) {
    console.warn("[News Gen] Gemini returned no sources in JSON. Caller will inject fallback sources.");
  }
  for (const source of sources) {
    if (!source.url) {
      throw new Error("Generated article has a source with missing URL.");
    }
  }

  // Validate and strip em dashes from FAQ
  const faq = Array.isArray(data.faq) ? data.faq : [];
  for (const item of faq) {
    if (item.q && hasEmDash(item.q)) item.q = stripEmDashes(item.q);
    if (item.a && hasEmDash(item.a)) item.a = stripEmDashes(item.a);
  }

  // Enforce meta title length
  let metaTitle = data.metaTitle as string;
  if (metaTitle.length > 60) {
    metaTitle = metaTitle.slice(0, 57) + "...";
  }

  // Enforce meta description length
  let metaDescription = data.metaDescription as string;
  if (metaDescription.length > 160) {
    metaDescription = metaDescription.slice(0, 157) + "...";
  }

  return {
    title: data.title as string,
    slug: data.slug as string,
    metaTitle,
    metaDescription,
    markdown: data.markdown as string,
    faq: faq as Array<{ q: string; a: string }>,
    internalLinks: (Array.isArray(data.internalLinks) ? data.internalLinks : []) as Array<{
      title: string;
      slug: string;
    }>,
    sources: sources as Array<{ title: string; url: string; publisher: string }>,
    confidenceLevel: data.confidenceLevel === "LOW" ? "LOW" : "HIGH",
    contentType: "NEWS",
  };
}

/* ------------------------------------------------------------------ */
/*  Main POST handler                                                   */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await requireAdmin();

    // 2. Validate Gemini key
    try {
      validateGeminiKey();
    } catch {
      return NextResponse.json(
        { error: "Gemini API key not configured." },
        { status: 500 }
      );
    }

    // 3. Rate limit
    const limiter = getNewsGenRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 10 news generations per day." },
          { status: 429 }
        );
      }
    }

    // 4. Parse and validate request
    const body = await req.json();
    const {
      topicId,
      topicTitle,
      angle,
      audienceFit,
      targetKeyword,
      secondaryKeywords,
      seedSourceUrls,
    } = body;

    if (!topicId || !topicTitle || !angle || !targetKeyword) {
      return NextResponse.json(
        { error: "topicId, topicTitle, angle, and targetKeyword are required." },
        { status: 400 }
      );
    }

    const validAudienceFit: AudienceFit[] = Array.isArray(audienceFit)
      ? audienceFit.filter((a: string) => a === "TRAVELLERS" || a === "TEACHERS")
      : ["TRAVELLERS", "TEACHERS"];

    const validSecondary: string[] = Array.isArray(secondaryKeywords)
      ? secondaryKeywords.filter((s: unknown) => typeof s === "string").slice(0, 10)
      : [];

    const validSeedUrls: string[] = Array.isArray(seedSourceUrls)
      ? seedSourceUrls.filter((u: unknown) => typeof u === "string" && String(u).startsWith("http")).slice(0, 10)
      : [];

    // 5. Create run record
    const run = await prisma.generatedArticleRun.create({
      data: {
        status: "RUNNING",
        settingsJson: JSON.stringify({
          type: "NEWS",
          topicId,
          topicTitle,
          angle,
          audienceFit: validAudienceFit,
          targetKeyword,
          secondaryKeywords: validSecondary,
          seedSourceUrls: validSeedUrls,
        }),
      },
    });

    try {
      // =========================================
      // Step 1: Validate and expand sources
      // =========================================
      const fetchedSources = await validateAndExpandSources(
        validSeedUrls,
        topicTitle,
        angle
      );

      // =========================================
      // Step 2: Build facts pack
      // =========================================
      const { bullets, bulletText, officialCount } = buildNewsFactsPack(
        fetchedSources,
        topicTitle,
        angle,
        validAudienceFit,
        targetKeyword,
        validSecondary
      );

      // Determine confidence based on accessible sources
      let confidence: "HIGH" | "LOW" = fetchedSources.length >= 3 ? "HIGH" : "LOW";

      // =========================================
      // Step 3: Check for duplicates
      // =========================================
      const existingContentPrompt = await checkForDuplicates(topicTitle);

      // =========================================
      // Step 4: Generate article via Gemini
      // =========================================
      const generationPrompt = buildNewsGenerationPrompt(
        topicTitle,
        angle,
        validAudienceFit,
        targetKeyword,
        validSecondary,
        bulletText,
        officialCount,
        fetchedSources.length,
        existingContentPrompt,
        validSeedUrls
      );

      const geminiResponse = await callGemini(generationPrompt);
      let totalTokens = geminiResponse.tokenCount ?? 0;

      // Parse and validate
      const parsed = parseGeminiJson(geminiResponse.text);
      const articleData = validateNewsArticle(parsed);

      // If Gemini returned no sources, inject fallback sources from fetched or seed URLs
      if (articleData.sources.length === 0) {
        if (fetchedSources.length > 0) {
          articleData.sources = fetchedSources.map((s) => ({
            title: s.title || "Source article",
            url: s.url,
            publisher: s.publisher,
          }));
        } else if (validSeedUrls.length > 0) {
          articleData.sources = validSeedUrls.map((url) => ({
            title: "Source article",
            url,
            publisher: getPublisherName(url),
          }));
        }
        // Force LOW confidence when sources had to be injected
        confidence = "LOW";
        articleData.confidenceLevel = "LOW";
        console.warn(`[News Gen] Injected ${articleData.sources.length} fallback sources.`);
      }

      if (articleData.confidenceLevel === "LOW") {
        confidence = "LOW";
      }

      // =========================================
      // Step 5: Humanization pass
      // =========================================
      let finalMarkdown = articleData.markdown;
      try {
        const humanizedResponse = await callGeminiText(
          buildNewsHumanizationPrompt(articleData.markdown)
        );
        totalTokens += humanizedResponse.tokenCount ?? 0;

        if (humanizedResponse.text.length > articleData.markdown.length * 0.5) {
          // Verify no em dashes in humanized version
          let humanizedText = humanizedResponse.text;
          if (hasEmDash(humanizedText)) {
            humanizedText = stripEmDashes(humanizedText);
          }
          finalMarkdown = humanizedText;
        }
      } catch (humanError) {
        console.error("[News Gen] Humanization pass failed, using original:", humanError);
      }

      // Strip hallucinated image markdown
      finalMarkdown = finalMarkdown.replace(/!\[.*?\]\(https?:\/\/[^)]+\)\n?/g, "");

      // =========================================
      // Step 6: Generate and upload images
      // =========================================
      let heroImageUrl: string | null = null;
      let ogImageUrl: string | null = null;
      let imagesJson: Array<Record<string, unknown>> = [];

      try {
        const imageSpecs = buildNewsImageSpecs(topicTitle, finalMarkdown);
        const slugBase = articleData.slug.slice(0, 40);
        const generatedImages = await generateAndUploadImages(imageSpecs, slugBase);

        if (generatedImages.length > 0) {
          const hero = generatedImages.find((img) => img.kind === "HERO");
          const og = generatedImages.find((img) => img.kind === "OG");

          if (hero) heroImageUrl = hero.storageUrl;
          if (og) ogImageUrl = og.storageUrl;

          finalMarkdown = injectImagesIntoMarkdown(finalMarkdown, generatedImages);

          imagesJson = generatedImages.map((img) => ({
            kind: img.kind,
            storageUrl: img.storageUrl,
            altText: img.altText,
            caption: img.caption || null,
            width: img.width,
            height: img.height,
            mimeType: img.mimeType,
            sectionHeading: img.sectionHeading || null,
          }));
        }
      } catch (imgError) {
        console.error("[News Gen] Image generation failed, continuing without images:", imgError);
      }

      // =========================================
      // Step 7: Save draft
      // =========================================
      let slug = articleData.slug;
      const existingSlug = await prisma.generatedArticleDraft.findUnique({
        where: { slug },
      });
      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }

      const draft = await prisma.generatedArticleDraft.create({
        data: {
          city: "Cambodia",
          topic: topicTitle,
          audience: validAudienceFit.join(", "),
          targetKeyword: targetKeyword || null,
          secondaryKeywords: validSecondary.join(", ") || null,
          title: articleData.title,
          slug,
          metaTitle: articleData.metaTitle,
          metaDescription: articleData.metaDescription,
          markdown: finalMarkdown,
          status: "DRAFT",
          confidence,
          heroImageUrl,
          ogImageUrl,
          imagesJson: imagesJson.length > 0
            ? (imagesJson as unknown as import("@prisma/client").Prisma.InputJsonValue)
            : undefined,
        },
      });

      // Save image records
      if (imagesJson.length > 0) {
        for (const img of imagesJson as Array<{
          kind: string; storageUrl: string; altText: string;
          caption: string | null; width: number; height: number;
          mimeType: string; sectionHeading: string | null;
        }>) {
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
      }

      // Save source records from article data
      if (articleData.sources.length > 0) {
        await prisma.generatedArticleSource.createMany({
          data: articleData.sources.map((source) => ({
            draftId: draft.id,
            url: source.url,
            title: source.title || null,
            publisher: source.publisher || null,
          })),
        });
      }

      // Also save fetched source records not already in article sources
      for (const source of fetchedSources) {
        const alreadySaved = articleData.sources.some((s) => s.url === source.url);
        if (!alreadySaved) {
          await prisma.generatedArticleSource.create({
            data: {
              draftId: draft.id,
              url: source.url,
              title: source.title || null,
              publisher: source.publisher,
              fetchedAt: source.fetchedAt,
              excerpt: source.text.slice(0, 500),
            },
          });
        }
      }

      // Update run record
      await prisma.generatedArticleRun.update({
        where: { id: run.id },
        data: {
          draftId: draft.id,
          status: "SUCCESS",
          finishedAt: new Date(),
          modelUsed: geminiResponse.modelUsed,
          tokenUsage: totalTokens,
        },
      });

      return NextResponse.json({
        draftId: draft.id,
        title: draft.title,
        slug: draft.slug,
        confidence,
        sourceCount: fetchedSources.length,
        imageCount: imagesJson.length,
      });
    } catch (genError) {
      // Update run as failed
      await prisma.generatedArticleRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: genError instanceof Error ? genError.message : "Unknown error",
        },
      });
      throw genError;
    }
  } catch (error) {
    console.error("[News Gen] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
