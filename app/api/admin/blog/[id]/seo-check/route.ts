import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSeoCheckRatelimit } from "@/lib/rate-limit";
import { validateGeminiKey, callGemini, parseGeminiJson } from "@/lib/ai/geminiClient";

/**
 * POST /api/admin/blog/[id]/seo-check
 * Run the Gemini SEO checker on a published post.
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
    const limiter = getSeoCheckRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 20 SEO checks per day." },
          { status: 429 }
        );
      }
    }

    const post = await prisma.generatedArticleDraft.findUnique({
      where: { id: params.id },
      include: { sources: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    // Accept optional overrides from the request body
    const body = await req.json().catch(() => ({}));
    const markdown = (body.markdown as string) || post.markdown;
    const title = (body.title as string) || post.title;
    const metaTitle = (body.metaTitle as string) || post.metaTitle;
    const metaDescription = (body.metaDescription as string) || post.metaDescription;
    const slug = post.slug;
    const targetKeyword = (body.targetKeyword as string) || post.targetKeyword || "";
    const secondaryKeywords = (body.secondaryKeywords as string) || post.secondaryKeywords || "";

    // Build the sources and internal links lists
    const sourcesList = post.sources.map((s) => s.url).join("\n");

    // Extract internal links from markdown
    const internalLinkMatches = markdown.match(/\]\(\/([\w-]+)\)/g) || [];
    const internalLinks = internalLinkMatches.map((m) => m.replace(/\]\(/, "").replace(/\)/, ""));

    const BANNED_WORDS = [
      "accordingly", "moreover", "robust", "vibrant", "innovative",
      "furthermore", "consequently", "nevertheless", "notwithstanding",
      "henceforth", "utilize", "leverage", "synergy", "paradigm",
      "holistic", "streamline", "cutting-edge", "game-changer",
      "ecosystem", "deep dive",
    ];

    const prompt = `
You are an SEO auditor. Analyze this blog post against the rubric below and return ONLY a JSON object.

POST DATA:
- Title: ${title}
- Meta Title: ${metaTitle}
- Meta Description: ${metaDescription}
- Slug: ${slug}
- Target Keyword: ${targetKeyword}
- Secondary Keywords: ${secondaryKeywords}

MARKDOWN:
${markdown}

SOURCES:
${sourcesList}

INTERNAL LINKS FOUND:
${internalLinks.join("\n")}

SEO RUBRIC:
1. Meta title length <= 60 characters
2. Meta description 140-160 characters
3. Target keyword appears in first 100 words of the markdown body
4. H1 exists and matches topic
5. At least 5 H2 sections
6. Includes "## Quick Take" section
7. Includes "## FAQ" section with at least 5 questions
8. Includes "## Related Guides" with internal links
9. Image presence: hero plus at least 2 inline images. If missing, mark as MINOR issue.
10. Avoid over-repetition of the exact keyword in headings (more than 3 times is too many)
11. No em dashes (unicode \\u2014 or \\u2013) anywhere
12. No banned words: ${BANNED_WORDS.join(", ")}
13. Table formatting is valid Markdown for cost posts when a Costs section exists
14. At least 3 internal links to other guides
15. E-E-A-T signals: has "Data last checked" line
16. Article schema should be present if schemaJson exists
17. FAQPage schema should be present when FAQ section exists
18. No "About the Author" section present
19. No HTML tags like <details> or <summary> present
20. No "Sources" section in the markdown body (sources are tracked separately)
21. FAQ answers should NOT be prefixed with "A:"

Return ONLY this JSON (no code fences):
{
  "score": <number 0-100>,
  "issues": [
    {
      "severity": "BLOCKER" | "MAJOR" | "MINOR",
      "code": "<short_code>",
      "message": "<human readable description>",
      "location": "metaTitle" | "metaDescription" | "intro" | "heading" | "faq" | "sources" | "links" | "schema" | "content",
      "suggestion": "<how to fix>"
    }
  ],
  "checks": {
    "metaTitleLengthOk": <boolean>,
    "metaDescriptionLengthOk": <boolean>,
    "keywordInFirst100Words": <boolean>,
    "h1Ok": <boolean>,
    "h2Count": <number>,
    "faqCount": <number>,
    "internalLinkCount": <number>,
    "sourcesWithUrls": <boolean>,
    "noEmDashes": <boolean>,
    "noAuthorCard": <boolean>,
    "noHtmlDetails": <boolean>,
    "noSourcesSection": <boolean>,
    "noFaqAPrefix": <boolean>
  }
}

Scoring: Start at 100. Subtract 25 per BLOCKER, 10 per MAJOR, 3 per MINOR. Minimum 0.
Never use em dashes in your output.
`.trim();

    const geminiResponse = await callGemini(prompt);
    const parsed = parseGeminiJson(geminiResponse.text);

    // Validate the response shape
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 0;
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const checks = typeof parsed.checks === "object" && parsed.checks ? parsed.checks : {};

    // Store results on the post
    await prisma.generatedArticleDraft.update({
      where: { id: params.id },
      data: {
        lastSeoScore: score,
        lastSeoCheckedAt: new Date(),
        seoIssuesJson: { score, issues, checks },
      },
    });

    return NextResponse.json({
      score,
      issues,
      checks,
      tokenCount: geminiResponse.tokenCount,
    });
  } catch (error) {
    console.error("[SEO Check] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SEO check failed." },
      { status: 500 }
    );
  }
}
