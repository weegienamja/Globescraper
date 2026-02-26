import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSeoFixRatelimit } from "@/lib/rate-limit";
import { validateGeminiKey, callGemini, parseGeminiJson } from "@/lib/ai/geminiClient";

const BANNED_WORDS = [
  "accordingly", "moreover", "robust", "vibrant", "innovative",
  "furthermore", "consequently", "nevertheless", "notwithstanding",
  "henceforth", "utilize", "leverage", "synergy", "paradigm",
  "holistic", "streamline", "cutting-edge", "game-changer",
  "ecosystem", "deep dive",
];

/**
 * POST /api/admin/blog/[id]/seo-fix
 * Auto-fix SEO issues using Gemini.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();

    // Validate Gemini key
    try {
      validateGeminiKey();
    } catch {
      return NextResponse.json(
        { error: "Gemini API key not configured." },
        { status: 500 }
      );
    }

    // Rate limit
    const limiter = getSeoFixRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 10 SEO fixes per day." },
          { status: 429 }
        );
      }
    }

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    if (!post.seoIssuesJson) {
      return NextResponse.json(
        { error: "Run an SEO check first before attempting auto-fix." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const currentMarkdown = (body.markdown as string) || post.markdown;
    const currentTitle = (body.title as string) || post.title;
    const currentMetaTitle = (body.metaTitle as string) || post.metaTitle;
    const currentMetaDesc = (body.metaDescription as string) || post.metaDescription;

    const seoData = post.seoIssuesJson as { issues?: Array<Record<string, string>> };
    const issues = Array.isArray(seoData.issues) ? seoData.issues : [];

    const issueList = issues
      .map((i) => `[${i.severity}] ${i.code}: ${i.message} -> ${i.suggestion}`)
      .join("\n");

    const prompt = `
You are an SEO editor. Fix the issues listed below in this blog post. Return ONLY a JSON object.

CURRENT POST:
Title: ${currentTitle}
Meta Title: ${currentMetaTitle}
Meta Description: ${currentMetaDesc}
Slug: ${post.slug}

CURRENT MARKDOWN:
${currentMarkdown}

ISSUES TO FIX:
${issueList}

RULES:
1. Fix only what is needed to resolve the listed issues.
2. Preserve the meaning, style, and structure of the content.
3. Use short sentences and active voice.
4. Use frequent line breaks and bullet points.
5. NEVER use em dashes (unicode \\u2014 or \\u2013). Use commas, periods, colons, or semicolons.
6. Do not invent facts or add unverifiable claims.
7. Do not copy competitor text.
8. Keep all existing source URLs intact. Do not add fake sources.
9. Do not add an "About the Author" section.
10. Do not add a "Sources" section to the markdown.
11. Remove any HTML tags like <details>, <summary>.
12. FAQ answers must NOT be prefixed with "A:".
13. Never use these banned words: ${BANNED_WORDS.join(", ")}.
14. Meta title must be under 60 characters.
15. Meta description must be 140-160 characters.

Return ONLY this JSON (no code fences):
{
  "title": "<fixed title>",
  "metaTitle": "<fixed meta title, max 60 chars>",
  "metaDescription": "<fixed meta description, 140-160 chars>",
  "slug": "<slug, usually unchanged>",
  "markdown": "<full fixed markdown>",
  "notes": "<brief summary of what was changed>"
}
`.trim();

    const geminiResponse = await callGemini(prompt);
    const parsed = parseGeminiJson(geminiResponse.text);

    // Validate required fields
    const requiredFields = ["title", "metaTitle", "metaDescription", "markdown"];
    for (const field of requiredFields) {
      if (!parsed[field] || typeof parsed[field] !== "string") {
        return NextResponse.json(
          { error: `Gemini response missing required field: ${field}` },
          { status: 500 }
        );
      }
    }

    // Validate no em dashes
    const emDashPattern = /\u2014|\u2013/;
    for (const field of requiredFields) {
      if (emDashPattern.test(parsed[field] as string)) {
        // Auto-fix em dashes
        (parsed as Record<string, string>)[field] = (parsed[field] as string)
          .replace(/\u2014/g, ", ")
          .replace(/\u2013/g, ", ");
      }
    }

    // Validate Sources section not present
    const md = parsed.markdown as string;
    if (/^## Sources/m.test(md)) {
      return NextResponse.json(
        { error: "Gemini added a Sources section to the markdown. Rejected. Try again." },
        { status: 500 }
      );
    }

    // Validate meta title length
    let fixedMetaTitle = parsed.metaTitle as string;
    if (fixedMetaTitle.length > 60) {
      fixedMetaTitle = fixedMetaTitle.slice(0, 57) + "...";
    }

    // Validate meta description length  
    let fixedMetaDesc = parsed.metaDescription as string;
    if (fixedMetaDesc.length > 160) {
      fixedMetaDesc = fixedMetaDesc.slice(0, 157) + "...";
    }

    return NextResponse.json({
      title: parsed.title as string,
      metaTitle: fixedMetaTitle,
      metaDescription: fixedMetaDesc,
      slug: (parsed.slug as string) || post.slug,
      markdown: parsed.markdown as string,
      notes: (parsed.notes as string) || "",
      tokenCount: geminiResponse.tokenCount,
    });
  } catch (error) {
    console.error("[SEO Fix] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SEO fix failed." },
      { status: 500 }
    );
  }
}
