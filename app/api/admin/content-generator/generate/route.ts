import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getContentGenRatelimit } from "@/lib/rate-limit";
import { validateGeminiKey, callGemini, parseGeminiJson, validateArticleData } from "@/lib/ai/geminiClient";
import { buildGenerationPrompt, buildIdeaOnlyPrompt } from "@/lib/ai/prompts";
import { buildSearchQueries, isAllowedSource, SOURCE_ALLOWLIST } from "@/lib/sourceAllowlist";
import { fetchPage, checkRobotsTxt } from "@/lib/scrape/fetchPage";
import { extractMainText, extractTitle } from "@/lib/scrape/extractMainText";
import { buildFactsPack, type SourceData } from "@/lib/scrape/buildFactsPack";

export const maxDuration = 60; // Allow up to 60 seconds for generation

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
    } = body;

    if (!city || !topic || !audience) {
      return NextResponse.json(
        { error: "City, topic, and audience are required." },
        { status: 400 }
      );
    }

    // 5. Create run record
    const run = await prisma.generatedArticleRun.create({
      data: {
        status: "RUNNING",
        settingsJson: JSON.stringify({ city, topic, audience, targetKeyword, secondaryKeywords, wordCount }),
      },
    });

    try {
      // 6. Source discovery
      const searchQueries = buildSearchQueries(city, topic, audience, targetKeyword);
      const discoveredUrls = new Set<string>();

      // Build candidate URLs from allowlist domains
      for (const query of searchQueries) {
        const searchTerms = query.toLowerCase().split(/\s+/);
        for (const source of SOURCE_ALLOWLIST) {
          // Build plausible URLs based on the domain
          const baseUrl = `https://www.${source.domain}`;
          discoveredUrls.add(baseUrl);
          // Add a search-style URL too
          const searchPath = searchTerms.slice(0, 3).join("-");
          discoveredUrls.add(`https://${source.domain}/${searchPath}`);
        }
      }

      // Also build direct search URLs for common patterns
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

      // 7. Fetch and extract (max 10 sources)
      const sourceData: SourceData[] = [];
      const urlArray = Array.from(discoveredUrls);

      for (const url of urlArray) {
        if (sourceData.length >= 10) break;

        const allowed = isAllowedSource(url);
        if (!allowed) continue;

        // Check robots.txt
        const robotsOk = await checkRobotsTxt(url);
        if (!robotsOk) continue;

        // Fetch page
        const html = await fetchPage(url);
        if (!html) continue;

        // Extract content
        const text = extractMainText(html);
        if (text.length < 100) continue;

        const title = extractTitle(html);

        sourceData.push({
          url,
          title,
          publisher: allowed.publisher,
          text,
          fetchedAt: new Date(),
        });
      }

      // 8. Generate article
      let geminiResponse;
      let confidence: "HIGH" | "LOW" = "HIGH";

      if (sourceData.length > 0) {
        // Research-backed generation
        const factsPack = buildFactsPack(
          city,
          topic,
          audience,
          sourceData,
          targetKeyword,
          secondaryKeywords
        );
        const prompt = buildGenerationPrompt(factsPack, wordCount);
        geminiResponse = await callGemini(prompt);
      } else {
        // Idea-only fallback
        confidence = "LOW";
        const prompt = buildIdeaOnlyPrompt(
          city,
          topic,
          audience,
          wordCount,
          targetKeyword,
          secondaryKeywords
        );
        geminiResponse = await callGemini(prompt);
      }

      // 9. Parse and validate response
      const parsed = parseGeminiJson(geminiResponse.text);
      const articleData = validateArticleData(parsed);

      // 10. Ensure unique slug
      let slug = articleData.slug;
      const existingSlug = await prisma.generatedArticleDraft.findUnique({
        where: { slug },
      });
      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }

      // 11. Save draft
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
          markdown: articleData.markdown,
          status: "DRAFT",
          confidence,
        },
      });

      // 12. Save source records
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

      // Also save fetched source data
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

      // 13. Update run record
      await prisma.generatedArticleRun.update({
        where: { id: run.id },
        data: {
          draftId: draft.id,
          status: "SUCCESS",
          finishedAt: new Date(),
          modelUsed: geminiResponse.modelUsed,
          tokenUsage: geminiResponse.tokenCount,
        },
      });

      return NextResponse.json({
        success: true,
        draftId: draft.id,
        title: draft.title,
        slug: draft.slug,
        confidence,
        sourceCount: sourceData.length,
      });
    } catch (genError) {
      // Update run record on failure
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
