import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validateGeminiKey } from "@/lib/ai/geminiClient";
import { getNewsSearchRatelimit } from "@/lib/rate-limit";
import { discoverNewsTopics } from "@/lib/newsTopicDiscovery";
import type { CityFocus, AudienceFocus } from "@/lib/newsTopicTypes";

export const maxDuration = 60;

const VALID_CITY_FOCUS = ["Phnom Penh", "Siem Reap", "Cambodia wide"];
const VALID_AUDIENCE_FOCUS = ["travellers", "teachers", "both"];

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
    const limiter = getNewsSearchRatelimit();
    if (limiter) {
      const { success } = await limiter.limit(session.user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 50 topic searches per day." },
          { status: 429 }
        );
      }
    }

    // 4. Parse request
    const body = await req.json().catch(() => ({}));
    const cityFocus: CityFocus = VALID_CITY_FOCUS.includes(body.cityFocus)
      ? body.cityFocus
      : "Cambodia wide";
    const audienceFocus: AudienceFocus = VALID_AUDIENCE_FOCUS.includes(body.audienceFocus)
      ? body.audienceFocus
      : "both";

    // 5. Discover topics
    const topics = await discoverNewsTopics(cityFocus, audienceFocus);

    if (topics.length === 0) {
      return NextResponse.json(
        { topics: [], message: "No timely Cambodia topics found. Try again later or adjust filters." },
        { status: 200 }
      );
    }

    return NextResponse.json({ topics });
  } catch (error) {
    console.error("[News Search] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
