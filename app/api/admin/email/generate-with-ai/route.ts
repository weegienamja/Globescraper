import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { callGemini } from "@/lib/ai/geminiClient";

/**
 * POST /api/admin/email/generate-with-ai
 * Generate email content using Gemini. Does NOT create a campaign.
 * Admin must review and click Save.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { objective, audienceSegment, tone, callToAction, lengthPreference } =
      await req.json();

    if (!objective) {
      return NextResponse.json(
        { error: "objective is required." },
        { status: 400 },
      );
    }

    const prompt = `You are an expert email copywriter for Globescraper, a community platform for English teachers moving to Cambodia.

Write a marketing email based on these parameters:
- Objective: ${objective}
- Audience: ${audienceSegment || "All users"}
- Tone: ${tone || "Friendly and professional"}
- Call to Action: ${callToAction || "Visit the platform"}
- Length: ${lengthPreference || "Medium (2-3 short paragraphs)"}

STRICT RULES:
1. Never use em dashes (--) or the unicode em dash character. Use commas, periods, or semicolons instead.
2. Write clear, scannable short paragraphs (2-3 sentences max).
3. Include a clear call-to-action.
4. Do not use spam trigger words like "FREE!!!", "Act now!!!", "Limited time!!!".
5. Keep subject lines under 60 characters.
6. Be personal but not exaggerated. Do not fabricate facts or statistics.
7. Preview text should be a compelling 40-90 character summary.
8. HTML content should use simple inline styles. Use a clean single-column layout.
9. Include an {{unsubscribe_link}} placeholder at the bottom of the HTML.
10. Do not use exclamation marks excessively (max 1 per email).

Return valid JSON with exactly these keys:
{
  "subject": "...",
  "previewText": "...",
  "htmlContent": "...",
  "textContent": "..."
}

Only return the JSON object. No markdown fences. No extra text.`;

    const result = await callGemini(prompt);

    let parsed;
    try {
      // Clean any markdown fences
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again.", raw: result.text },
        { status: 422 },
      );
    }

    // Validate required fields
    if (!parsed.subject || !parsed.htmlContent) {
      return NextResponse.json(
        { error: "AI generated incomplete email content.", raw: result.text },
        { status: 422 },
      );
    }

    // Post-process: strip any em dashes that slipped through
    const stripEmDashes = (s: string) =>
      s.replace(/\u2014/g, ",").replace(/\u2013/g, ",").replace(/--/g, ",");

    parsed.subject = stripEmDashes(parsed.subject);
    parsed.previewText = stripEmDashes(parsed.previewText || "");
    parsed.htmlContent = stripEmDashes(parsed.htmlContent);
    parsed.textContent = stripEmDashes(parsed.textContent || "");

    return NextResponse.json({
      ok: true,
      generated: parsed,
      tokensUsed: result.tokenCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
