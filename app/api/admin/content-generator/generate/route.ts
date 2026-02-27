import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getContentGenRatelimit } from "@/lib/rate-limit";
import { validateGeminiKey, callGemini, callGeminiText, parseGeminiJson, validateArticleData } from "@/lib/ai/geminiClient";
import { buildGenerationPrompt, buildIdeaOnlyPrompt, buildHumanizationPrompt } from "@/lib/ai/prompts";
import { buildSearchQueries, isAllowedSource, SOURCE_ALLOWLIST } from "@/lib/sourceAllowlist";
import { fetchPage, checkRobotsTxt } from "@/lib/scrape/fetchPage";
import { extractMainText, extractTitle } from "@/lib/scrape/extractMainText";
import { buildFactsPack, type SourceData } from "@/lib/scrape/buildFactsPack";
import { runCompetitorAnalysis } from "@/lib/scrape/competitorAnalysis";
import { discoverCompetitors, buildExistingContentDigest } from "@/lib/scrape/contentDiscovery";
import {
  buildImageSpecs,
  generateAndUploadImages,
  injectImagesIntoMarkdown,
  extractHeadings,
} from "@/lib/ai/imageGen";
import { generateHybridImages } from "@/lib/ai/imageSearch";

export const maxDuration = 120; // Allow up to 120 seconds for generation + images

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
    const limiter = getContentGenRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 10 generations per day." },
          { status: 429 }
        );
      }
    }

    // 4. Parse request body
    const body = await req.json();
    const {
      city,
      topic,
      audience,
      targetKeyword,
      secondaryKeywords,
      wordCount = 1200,
      competitorUrls = [],
    } = body;

    if (!city || !topic || !audience) {
      return NextResponse.json(
        { error: "City, topic, and audience are required." },
        { status: 400 }
      );
    }

    // Validate competitor URLs
    const validCompetitorUrls = (Array.isArray(competitorUrls) ? competitorUrls : [])
      .filter((u: unknown) => typeof u === "string" && u.trim().length > 0)
      .slice(0, 3) as string[];

    // 5. Create run record
    const run = await prisma.generatedArticleRun.create({
      data: {
        status: "RUNNING",
        settingsJson: JSON.stringify({
          city, topic, audience, targetKeyword, secondaryKeywords, wordCount,
          competitorUrls: validCompetitorUrls,
        }),
      },
    });

    try {
      // =========================================
      // A. Source discovery and fetching
      // =========================================
      const searchQueries = buildSearchQueries(city, topic, audience, targetKeyword);
      const discoveredUrls = new Set<string>();

      for (const query of searchQueries) {
        const searchTerms = query.toLowerCase().split(/\s+/);
        for (const source of SOURCE_ALLOWLIST) {
          const baseUrl = `https://www.${source.domain}`;
          discoveredUrls.add(baseUrl);
          const searchPath = searchTerms.slice(0, 3).join("-");
          discoveredUrls.add(`https://${source.domain}/${searchPath}`);
        }
      }

      const citySlug = city.toLowerCase().replace(/\s+/g, "-");
      const topicSlug = topic.toLowerCase().replace(/\s+/g, "-");
      const directUrls = [
        `https://www.numbeo.com/cost-of-living/in/${city.replace(/\s+/g, "-")}`,
        `https://www.expatistan.com/cost-of-living/${citySlug}`,
        `https://move2cambodia.com/${topicSlug}`,
        `https://move2cambodia.com/${citySlug}`,
        `https://www.reddit.com/r/cambodia/search/?q=${encodeURIComponent(`${city} ${topic}`)}`,
      ];
      for (const u of directUrls) {
        discoveredUrls.add(u);
      }

      const sourceData: SourceData[] = [];
      const urlArray = Array.from(discoveredUrls);

      for (const url of urlArray) {
        if (sourceData.length >= 10) break;
        const allowed = isAllowedSource(url);
        if (!allowed) continue;
        const robotsOk = await checkRobotsTxt(url);
        if (!robotsOk) continue;
        const html = await fetchPage(url);
        if (!html) continue;
        const text = extractMainText(html);
        if (text.length < 100) continue;
        const title = extractTitle(html);
        sourceData.push({
          url, title, publisher: allowed.publisher, text, fetchedAt: new Date(),
        });
      }

      // =========================================
      // B. Auto-discover competitors + manual URLs
      // =========================================
      const discovered = await discoverCompetitors(
        city, topic, targetKeyword, validCompetitorUrls
      );
      const allCompetitorUrls = discovered.map((d) => d.url);

      let competitorPromptSummary = "";
      if (allCompetitorUrls.length > 0) {
        const sourceBullets = sourceData.map((s) => s.text.slice(0, 500)).join("\n");
        const gapResult = await runCompetitorAnalysis(
          allCompetitorUrls,
          sourceBullets,
          topic
        );
        competitorPromptSummary = gapResult.promptSummary;
      }

      // =========================================
      // B2. Check existing content for dedup
      // =========================================
      const { promptSection: existingContentPrompt } = await buildExistingContentDigest();

      // =========================================
      // C. Quality guardrail: assess source confidence
      // =========================================
      const accessibleSourceCount = sourceData.length;
      let confidence: "HIGH" | "LOW" = accessibleSourceCount >= 3 ? "HIGH" : "LOW";

      // =========================================
      // D. Generate article via Gemini
      // =========================================
      let geminiResponse;
      let totalTokens = 0;

      if (sourceData.length > 0) {
        const factsPack = buildFactsPack(
          city, topic, audience, sourceData, targetKeyword, secondaryKeywords
        );
        const prompt = buildGenerationPrompt(
          factsPack, wordCount,
          competitorPromptSummary || undefined,
          existingContentPrompt || undefined
        );
        geminiResponse = await callGemini(prompt);
      } else {
        confidence = "LOW";
        const prompt = buildIdeaOnlyPrompt(
          city, topic, audience, wordCount, targetKeyword, secondaryKeywords,
          existingContentPrompt || undefined
        );
        geminiResponse = await callGemini(prompt);
      }
      totalTokens += geminiResponse.tokenCount ?? 0;

      // =========================================
      // E. Parse and validate response
      // =========================================
      const parsed = parseGeminiJson(geminiResponse.text);
      const articleData = validateArticleData(parsed);

      // Use the AI's confidence assessment if it flagged LOW
      if (articleData.confidenceLevel === "LOW") {
        confidence = "LOW";
      }

      // =========================================
      // F. Humanization pass
      // =========================================
      let finalMarkdown = articleData.markdown;
      try {
        const humanizedResponse = await callGeminiText(
          buildHumanizationPrompt(articleData.markdown)
        );
        totalTokens += humanizedResponse.tokenCount ?? 0;
        // Only use it if the response is reasonable length
        if (humanizedResponse.text.length > articleData.markdown.length * 0.5) {
          finalMarkdown = humanizedResponse.text;
        }
      } catch (humanError) {
        console.error("[Content Generator] Humanization pass failed, using original:", humanError);
        // Continue with original markdown
      }

      // =========================================
      // G. Strip hallucinated image markdown
      // =========================================
      // Gemini sometimes invents fake image URLs (e.g. unsplash).
      // Real images are generated by Imagen and injected below.
      finalMarkdown = finalMarkdown.replace(/!\[.*?\]\(https?:\/\/[^)]+\)\n?(?:\*[^*]+\*\n?)?/g, "");

      // =========================================
      // H. Generate and upload images
      // =========================================
      let heroImageUrl: string | null = null;
      let ogImageUrl: string | null = null;
      let imagesJson: Array<Record<string, unknown>> = [];

      try {
        const sectionHeadings = extractHeadings(finalMarkdown);
        const imageSpecs = buildImageSpecs(city, topic, articleData.title, sectionHeadings);
        const slugBase = articleData.slug.slice(0, 40);
        const generatedImages = await generateHybridImages(articleData.title, imageSpecs, slugBase);

        if (generatedImages.length > 0) {
          const hero = generatedImages.find((img) => img.kind === "HERO");
          const og = generatedImages.find((img) => img.kind === "OG");

          if (hero) heroImageUrl = hero.storageUrl;
          if (og) ogImageUrl = og.storageUrl;

          // Inject images into markdown
          finalMarkdown = injectImagesIntoMarkdown(finalMarkdown, generatedImages);

          // Build images JSON for storage
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
        console.error("[Content Generator] Image generation failed, continuing without images:", imgError);
        // Not fatal: article works fine without images
      }

      // =========================================
      // H. Save draft with images
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
          city,
          topic,
          audience,
          targetKeyword: targetKeyword || null,
          secondaryKeywords: secondaryKeywords || null,
          title: articleData.title,
          slug,
          metaTitle: articleData.metaTitle,
          metaDescription: articleData.metaDescription,
          markdown: finalMarkdown,
          status: "DRAFT",
          confidence,
          heroImageUrl,
          ogImageUrl,
          imagesJson: imagesJson.length > 0 ? (imagesJson as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
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
              prompt: "", // We don't store the prompt in the images table for now
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

      // Save source records
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

      for (const source of sourceData) {
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

      // =========================================
      // I. Update run record
      // =========================================
      await prisma.generatedArticleRun.update({
        where: { id: run.id },
        data: {
          draftId: draft.id,
          status: "SUCCESS",
          finishedAt: new Date(),
          modelUsed: geminiResponse.modelUsed,
          tokenUsage: totalTokens || geminiResponse.tokenCount,
        },
      });

      return NextResponse.json({
        success: true,
        draftId: draft.id,
        title: draft.title,
        slug: draft.slug,
        confidence,
        sourceCount: accessibleSourceCount,
        imageCount: imagesJson.length,
        competitorCount: allCompetitorUrls.length,
      });
    } catch (genError) {
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
    console.error("[Content Generator] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
