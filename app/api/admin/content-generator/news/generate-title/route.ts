import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getNewsSearchRatelimit } from "@/lib/rate-limit";
import { generateBestTitle } from "@/lib/news/coverageAnalysis";
import type { CityFocus, AudienceFocus } from "@/lib/newsTopicTypes";

export const maxDuration = 30;

const VALID_CITY_FOCUS = ["Phnom Penh", "Siem Reap", "Cambodia wide"];
const VALID_AUDIENCE_FOCUS = ["travellers", "teachers", "both"];

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const session = await requireAdmin();

    // 2. Rate limit (shares the news search limiter)
    const limiter = getNewsSearchRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429 }
        );
      }
    }

    // 3. Parse request
    const body = await req.json().catch(() => ({}));
    const cityFocus: CityFocus = VALID_CITY_FOCUS.includes(body.cityFocus)
      ? body.cityFocus
      : "Cambodia wide";
    const audienceFocus: AudienceFocus = VALID_AUDIENCE_FOCUS.includes(body.audienceFocus)
      ? body.audienceFocus
      : "both";

    // 4. Generate a unique title based on coverage gap analysis
    const result = await generateBestTitle(cityFocus, audienceFocus);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Generate Title] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
