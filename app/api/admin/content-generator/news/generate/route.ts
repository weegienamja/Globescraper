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
import { generateHybridImages } from "@/lib/ai/imageSearch";
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
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const currentYear = now.getFullYear();
  const todayFormatted = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const audienceDesc = audienceFit.includes("TRAVELLERS") && audienceFit.includes("TEACHERS")
    ? "both travellers to Cambodia and English teachers living or planning to live there"
    : audienceFit.includes("TRAVELLERS")
      ? "travellers to Cambodia"
      : "English teachers in Cambodia";

  return `TODAY'S DATE: ${todayFormatted}
CURRENT YEAR: ${currentYear}

You are a professional news and travel content writer for GlobeScraper, a website about moving to and visiting Cambodia.

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
15. When referencing a year, always use the current year (${currentYear}). NEVER use a past year like ${currentYear - 1} unless citing a specific historical event.

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
  const topicLower = topicTitle.toLowerCase();

  const specs: ImageSpec[] = [];

  // ── Derive topic-specific visual cues ──
  const topicCue = deriveVisualCue(topicLower);

  // HERO image — driven by the actual article title for maximum relevance
  specs.push({
    kind: "HERO",
    prompt: `Photorealistic travel documentary photograph of Cambodia. Wide landscape shot of ${topicCue.heroScene}. The article title is: "${topicTitle}". The image must visually represent this specific title. Showing real places and daily life. ${style} ${noText}`,
    altText: stripEmDashes(`Cambodia scene related to ${topicTitle.toLowerCase()}`),
    width: 1344,
    height: 768,
  });

  // OG image — driven by the actual article title
  specs.push({
    kind: "OG",
    prompt: `Photorealistic cinematic wide shot of Cambodia. ${topicCue.ogScene}. The article title is: "${topicTitle}". The image must visually represent this specific title. Vibrant but realistic. ${style} ${noText}`,
    altText: stripEmDashes(`${topicTitle} preview image`),
    width: 1200,
    height: 630,
  });

  // ── INLINE images: derive prompts from actual article headings ──
  const usedPromptKeys = new Set<string>();
  const inlineSpecs = headings
    .slice(0, 10) // only consider first 10 headings
    .map((heading) => {
      const match = matchHeadingToScene(heading, topicLower, usedPromptKeys);
      if (!match) return null;
      usedPromptKeys.add(match.key);
      return {
        heading,
        prompt: match.prompt,
        alt: match.alt,
        caption: match.caption,
      };
    })
    .filter(Boolean)
    .slice(0, 3) as Array<{ heading: string; prompt: string; alt: string; caption: string }>;

  // Fallback: if we couldn't match enough headings, use topic-derived scenes
  while (inlineSpecs.length < 3) {
    const fb = topicCue.fallbackInlines[inlineSpecs.length] || {
      prompt: `A busy Cambodia street scene with locals going about daily life. ${style} ${noText}`,
      alt: "Daily life in Cambodia",
      caption: "Everyday Cambodia",
    };
    inlineSpecs.push({
      heading: headings[Math.min(inlineSpecs.length + 1, headings.length - 1)] || "More Details",
      prompt: fb.prompt,
      alt: fb.alt,
      caption: fb.caption,
    });
  }

  for (const inline of inlineSpecs) {
    specs.push({
      kind: "INLINE",
      prompt: `Photorealistic travel documentary photograph of Cambodia. ${inline.prompt} ${style} ${noText}`,
      altText: stripEmDashes(inline.alt),
      caption: stripEmDashes(inline.caption),
      width: 1024,
      height: 576,
      sectionHeading: inline.heading,
    });
  }

  return specs;
}

/** Map of visual keywords to scene descriptions for inline images. */
const SCENE_MAP: Record<string, { prompt: string; alt: string; caption: string }> = {
  visa: { prompt: "Exterior of a Cambodian immigration office or border checkpoint, documentary style.", alt: "Cambodia immigration office", caption: "Visa and immigration in Cambodia" },
  border: { prompt: "Travellers queuing at a Cambodia-Thailand or Cambodia-Vietnam land border crossing.", alt: "Border crossing in Cambodia", caption: "A border checkpoint in Cambodia" },
  airport: { prompt: "Phnom Penh or Siem Reap airport terminal, passengers with luggage, bright and modern interior.", alt: "Cambodia airport terminal", caption: "Arriving at a Cambodia airport" },
  transport: { prompt: "A tuk tuk driving through Phnom Penh traffic on a sunny day, passengers visible.", alt: "Tuk tuk ride in Cambodia", caption: "Getting around by tuk tuk" },
  bus: { prompt: "A long-distance bus at a Cambodia bus station with passengers boarding.", alt: "Bus station in Cambodia", caption: "Inter-city travel in Cambodia" },
  flight: { prompt: "Aerial or terminal view of a Cambodian airport with planes on the tarmac.", alt: "Airport in Cambodia", caption: "Flying in and out of Cambodia" },
  cost: { prompt: "Fresh produce stall at a Cambodian wet market with handwritten price signs.", alt: "Market prices in Cambodia", caption: "Everyday prices at a local market" },
  price: { prompt: "A Cambodian supermarket aisle showing consumer products on shelves.", alt: "Supermarket shopping in Cambodia", caption: "Shopping in Cambodia" },
  rent: { prompt: "A modern apartment building exterior in Phnom Penh with balconies and tropical plants.", alt: "Apartments in Phnom Penh", caption: "Typical apartment building" },
  hotel: { prompt: "A boutique guesthouse exterior in Siem Reap with lush tropical garden.", alt: "Guesthouse in Cambodia", caption: "Accommodation in Cambodia" },
  food: { prompt: "A busy Cambodian street food vendor cooking noodles over a flame, steam rising.", alt: "Street food in Cambodia", caption: "Cambodian street food" },
  restaurant: { prompt: "Interior of a riverside restaurant in Phnom Penh, tables set near water.", alt: "Riverside dining in Cambodia", caption: "Dining by the river" },
  safety: { prompt: "A well-lit Phnom Penh street at dusk with open shopfronts and evening foot traffic.", alt: "Evening in Phnom Penh", caption: "Evening atmosphere in Cambodia" },
  scam: { prompt: "A crowded tourist area near a Cambodia temple with vendors and tour guides.", alt: "Tourist area in Cambodia", caption: "Navigating tourist areas" },
  teach: { prompt: "Inside a bright Cambodian classroom, English vocabulary on whiteboard, students at desks.", alt: "English classroom in Cambodia", caption: "Teaching English in Cambodia" },
  school: { prompt: "Exterior of a Cambodian school building with students arriving, gates open.", alt: "School in Cambodia", caption: "A school in Cambodia" },
  health: { prompt: "A modern private clinic entrance in Phnom Penh, professional and clean exterior.", alt: "Medical clinic in Cambodia", caption: "Healthcare in Cambodia" },
  hospital: { prompt: "Royal Phnom Penh Hospital or a modern medical facility exterior, ambulance visible.", alt: "Hospital in Cambodia", caption: "Medical facilities in Cambodia" },
  temple: { prompt: "Golden spires of a Cambodian pagoda against blue sky, ornate traditional architecture.", alt: "Buddhist temple in Cambodia", caption: "A Cambodian pagoda" },
  culture: { prompt: "Traditional Apsara dancers performing in front of ancient Angkor stonework.", alt: "Apsara dance performance", caption: "Traditional Cambodian dance" },
  sim: { prompt: "A mobile phone shop in Cambodia with SIM card advertisements and a custome being served.", alt: "Mobile shop in Cambodia", caption: "Getting connected in Cambodia" },
  bank: { prompt: "ATMs and a bank branch on a Phnom Penh street, clean modern facade.", alt: "Banking in Cambodia", caption: "Financial services in Cambodia" },
  money: { prompt: "Cambodian riel and US dollar banknotes on a market counter with goods.", alt: "Currency in Cambodia", caption: "Using cash in Cambodia" },
  weather: { prompt: "Dramatic monsoon clouds over Tonle Sap lake with fishing boats in foreground.", alt: "Rainy season in Cambodia", caption: "Cambodia's wet season" },
  flood: { prompt: "Phnom Penh street during heavy monsoon rain, puddles reflecting lights.", alt: "Monsoon rain in Cambodia", caption: "Rainy season conditions" },
  expat: { prompt: "A cozy cafe in BKK1 Phnom Penh, expats and locals mixed, laptops and coffee.", alt: "Expat cafe in Phnom Penh", caption: "Expat social life" },
  digital: { prompt: "A co-working space interior in Phnom Penh, desks with monitors, bright and modern.", alt: "Co-working in Phnom Penh", caption: "Digital nomad workspace" },
  nightlife: { prompt: "Neon-lit street in Phnom Penh with bars and restaurants, evening buzz.", alt: "Nightlife street in Phnom Penh", caption: "Evening entertainment" },
  market: { prompt: "Central Market Phnom Penh art-deco dome exterior with vendors outside.", alt: "Central Market, Phnom Penh", caption: "The famous Central Market" },
  angkor: { prompt: "Sunrise over Angkor Wat, silhouette of towers reflected in moat.", alt: "Angkor Wat at sunrise", caption: "Sunrise at Angkor Wat" },
  siem: { prompt: "Pub Street Siem Reap at dusk, colourful signage, tourists strolling.", alt: "Pub Street, Siem Reap", caption: "Siem Reap's famous Pub Street" },
  phnom: { prompt: "Phnom Penh riverfront promenade at golden hour, Royal Palace in background.", alt: "Phnom Penh riverfront", caption: "The Phnom Penh riverfront" },
};

/**
 * Derive a visual cue set from the topic title for hero/OG/fallback images.
 */
function deriveVisualCue(topicLower: string): {
  heroScene: string;
  ogScene: string;
  fallbackInlines: Array<{ prompt: string; alt: string; caption: string }>;
} {
  // Try to pick scene-appropriate visuals based on topic keywords
  if (/airport|terminal|kti|pnh|rep|aviation|runway/.test(topicLower)) {
    return {
      heroScene: "a modern Cambodian airport terminal building, planes on tarmac, passengers with luggage",
      ogScene: "Aerial or exterior view of a Cambodian airport, modern terminal architecture",
      fallbackInlines: [
        SCENE_MAP.airport, SCENE_MAP.flight, SCENE_MAP.transport,
      ],
    };
  }
  if (/flight|airline|flying|route/.test(topicLower)) {
    return {
      heroScene: "planes at a Cambodian airport terminal, passengers boarding, bright modern interior",
      ogScene: "Cambodian airport departure area with flight information boards",
      fallbackInlines: [
        SCENE_MAP.flight, SCENE_MAP.airport, SCENE_MAP.transport,
      ],
    };
  }
  if (/visa|entry|border|passport|arrival|immigration/.test(topicLower)) {
    return {
      heroScene: "a Cambodia border checkpoint or immigration hall with travellers",
      ogScene: "Travellers at a Cambodian airport or border, documentary feel",
      fallbackInlines: [
        SCENE_MAP.airport, SCENE_MAP.border, SCENE_MAP.transport,
      ],
    };
  }
  if (/cost|price|expens|cheap|budget|salary/.test(topicLower)) {
    return {
      heroScene: "a vibrant Cambodian market with colourful produce and price tags",
      ogScene: "A busy Cambodian market scene, showing everyday items and prices",
      fallbackInlines: [
        SCENE_MAP.cost, SCENE_MAP.food, SCENE_MAP.rent,
      ],
    };
  }
  if (/teach|school|class|english|education/.test(topicLower)) {
    return {
      heroScene: "a bright modern classroom in Cambodia with a whiteboard and student desks",
      ogScene: "An English classroom in Cambodia, warm natural light",
      fallbackInlines: [
        SCENE_MAP.teach, SCENE_MAP.school, SCENE_MAP.expat,
      ],
    };
  }
  if (/health|hospital|clinic|medical|dengue|covid/.test(topicLower)) {
    return {
      heroScene: "a modern Cambodian hospital or clinic entrance, professional and reassuring",
      ogScene: "Healthcare facility in Cambodia, clean and modern",
      fallbackInlines: [
        SCENE_MAP.health, SCENE_MAP.hospital, SCENE_MAP.phnom,
      ],
    };
  }
  if (/safety|crime|scam|danger|police/.test(topicLower)) {
    return {
      heroScene: "a well-lit Phnom Penh street at night with open shopfronts and locals",
      ogScene: "Safe, busy Cambodia evening street scene",
      fallbackInlines: [
        SCENE_MAP.safety, SCENE_MAP.scam, SCENE_MAP.nightlife,
      ],
    };
  }
  if (/rent|apartment|accommodation|housing|stay/.test(topicLower)) {
    return {
      heroScene: "a modern apartment building in Phnom Penh BKK1 area, tropical plants on balconies",
      ogScene: "Residential buildings in a popular Phnom Penh neighbourhood",
      fallbackInlines: [
        SCENE_MAP.rent, SCENE_MAP.expat, SCENE_MAP.market,
      ],
    };
  }
  if (/transport|tuk|bus|drive|moto|grab/.test(topicLower)) {
    return {
      heroScene: "a tuk tuk navigating busy Phnom Penh traffic, bustling city atmosphere",
      ogScene: "Transport scene in Cambodia, tuk tuks and motorbikes",
      fallbackInlines: [
        SCENE_MAP.transport, SCENE_MAP.bus, SCENE_MAP.phnom,
      ],
    };
  }
  if (/sim|phone|internet|wifi|bank|money|atm/.test(topicLower)) {
    return {
      heroScene: "a Phnom Penh street with SIM card shops, bank branches, and ATMs",
      ogScene: "Getting connected and managing money in Cambodia",
      fallbackInlines: [
        SCENE_MAP.sim, SCENE_MAP.bank, SCENE_MAP.money,
      ],
    };
  }
  if (/angkor|siem reap|temple/.test(topicLower)) {
    return {
      heroScene: "Angkor Wat towers at golden hour, ancient stone and lush jungle",
      ogScene: "Angkor temples at golden hour, dramatic sky",
      fallbackInlines: [
        SCENE_MAP.angkor, SCENE_MAP.siem, SCENE_MAP.temple,
      ],
    };
  }
  if (/weather|rain|monsoon|flood|season/.test(topicLower)) {
    return {
      heroScene: "dramatic monsoon clouds over the Mekong River near Phnom Penh",
      ogScene: "Cambodia weather scene, dramatic skies over water",
      fallbackInlines: [
        SCENE_MAP.weather, SCENE_MAP.flood, SCENE_MAP.phnom,
      ],
    };
  }
  // Default: generic Cambodia
  return {
    heroScene: "a wide panoramic view of the Phnom Penh skyline from the riverfront at golden hour",
    ogScene: "Cambodia panorama, skyline or landscape, warm golden light",
    fallbackInlines: [
      SCENE_MAP.phnom, SCENE_MAP.food, SCENE_MAP.market,
    ],
  };
}

/**
 * Match an article heading to the best unused scene from SCENE_MAP.
 */
function matchHeadingToScene(
  heading: string,
  topicLower: string,
  usedKeys: Set<string>
): { key: string; prompt: string; alt: string; caption: string } | null {
  const hLower = heading.toLowerCase();
  const combined = `${hLower} ${topicLower}`;

  for (const [key, scene] of Object.entries(SCENE_MAP)) {
    if (usedKeys.has(key)) continue;
    if (combined.includes(key)) {
      return { key, ...scene };
    }
  }
  return null;
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

      // Parse and validate — with one auto-repair attempt on bad JSON
      let parsed: Record<string, unknown>;
      try {
        parsed = parseGeminiJson(geminiResponse.text);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message === "INVALID_JSON") {
          console.warn("[News Gen] First Gemini response was not valid JSON. Attempting repair...");
          const repairPrompt = `The following text was supposed to be a valid JSON object with keys: title, slug, metaTitle, metaDescription, markdown, faq, sources, internalLinks, confidenceLevel. But it is not valid JSON.

Raw text (first 4000 chars):
${geminiResponse.text.slice(0, 4000)}

Fix it and return ONLY valid JSON. No prose, no explanation, no markdown fences. Just the corrected JSON object.`;

          const repairResponse = await callGemini(repairPrompt);
          totalTokens += repairResponse.tokenCount ?? 0;

          try {
            parsed = parseGeminiJson(repairResponse.text);
          } catch {
            throw new Error("Gemini returned invalid JSON even after repair attempt. Please try regenerating.");
          }
        } else {
          throw parseErr;
        }
      }

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

      // Strip hallucinated image markdown and any trailing captions
      finalMarkdown = finalMarkdown.replace(/!\[.*?\]\(https?:\/\/[^)]+\)\n?(?:\*[^*]+\*\n?)?/g, "");

      // =========================================
      // Step 6: Generate and upload images
      // =========================================
      let heroImageUrl: string | null = null;
      let ogImageUrl: string | null = null;
      let imagesJson: Array<Record<string, unknown>> = [];

      try {
        const imageSpecs = buildNewsImageSpecs(topicTitle, finalMarkdown);
        const slugBase = articleData.slug.slice(0, 40);
        const generatedImages = await generateHybridImages(topicTitle, imageSpecs, slugBase);

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
