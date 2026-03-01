/**
 * AI-powered listing review using Gemini.
 *
 * Batches 15–20 listings per Gemini call, asking the model to classify
 * each listing as residential/non-residential, suggest the correct
 * PropertyType, and flag anomalies. Results are stored in RentalAiReview.
 *
 * Cost estimate (gemini-3-flash):
 *   20 listings × ~200 input tokens = ~4k input tokens/call
 *   20 listings × ~50 output tokens = ~1k output tokens/call
 *   3,000 listings ÷ 20/batch = 150 calls ≈ $0.02–0.05 per full audit
 */

import { PropertyType } from "@prisma/client";
import { callGemini, parseGeminiJson, validateGeminiKey } from "@/lib/ai/geminiClient";
import { prisma } from "@/lib/prisma";

/* ── Types ───────────────────────────────────────────────── */

export interface ListingForReview {
  id: string;
  title: string;
  description: string | null;
  propertyType: string;
  priceMonthlyUsd: number | null;
  bedrooms: number | null;
  district: string | null;
  canonicalUrl: string;
}

export interface AiVerdict {
  /** The listing ID we passed in */
  listingId: string;
  /** Is this a residential property? */
  isResidential: boolean;
  /** Suggested PropertyType (one of the valid enum values) */
  suggestedType: string | null;
  /** Confidence 0.0–1.0 */
  confidence: number;
  /** One-line reason for the verdict */
  reason: string;
}

interface BatchResult {
  verdicts: AiVerdict[];
  tokenCount: number | null;
}

/* ── Constants ───────────────────────────────────────────── */

const BATCH_SIZE = 15;

const VALID_TYPES = new Set(Object.values(PropertyType));

const RESIDENTIAL_TYPES = new Set<string>([
  "APARTMENT", "CONDO", "HOUSE", "VILLA", "TOWNHOUSE",
  "SERVICED_APARTMENT", "PENTHOUSE",
]);

/* ── Prompt ──────────────────────────────────────────────── */

function buildBatchPrompt(listings: ListingForReview[]): string {
  const items = listings.map((l, i) => {
    const descSnippet = l.description
      ? l.description.slice(0, 300).replace(/\n/g, " ").trim()
      : "(no description)";
    return [
      `[${i + 1}] id="${l.id}"`,
      `  title: "${l.title}"`,
      `  description_excerpt: "${descSnippet}"`,
      `  current_type: ${l.propertyType}`,
      `  price: ${l.priceMonthlyUsd ? `$${l.priceMonthlyUsd}/mo` : "unknown"}`,
      `  bedrooms: ${l.bedrooms ?? "unknown"}`,
      `  district: ${l.district ?? "unknown"}`,
    ].join("\n");
  });

  return `You are a property listing quality auditor for Cambodia real estate.

Review each listing below and determine:
1. Is it a RESIDENTIAL property (apartment, condo, house, villa, townhouse, serviced apartment, penthouse)?
2. If residential, what is the correct PropertyType? Choose from: APARTMENT, CONDO, HOUSE, VILLA, TOWNHOUSE, SERVICED_APARTMENT, PENTHOUSE
3. If NOT residential (warehouse, office, commercial, land, shophouse, hotel, etc.), mark isResidential=false
4. Flag any anomalies: wrong classification, suspiciously low/high price for the type, possible scam, or duplicate patterns

Return a JSON array with one object per listing:
[
  {
    "listingId": "<the id value>",
    "isResidential": true/false,
    "suggestedType": "APARTMENT" (or null if non-residential),
    "confidence": 0.0-1.0,
    "reason": "brief explanation"
  }
]

Key rules:
- "Serviced apartment" = furnished apartment with hotel-like services (cleaning, reception)
- "Condo" = unit in a condominium building (often with gym, pool, security)
- "Studio" without more context = APARTMENT
- "Borey" = housing development = HOUSE
- Price sanity: typical Phnom Penh apartment $200-2000/mo, house $500-5000/mo, villa $1000-10000/mo
- Buildings named "Park Land", "Parkland", "Urban Village" etc. are RESIDENTIAL despite containing "land"/"village"
- If description mentions "warehouse for rent", "office space", "commercial" as the main offering, it's non-residential
- Confidence should be 0.9+ if title clearly matches type, 0.5-0.8 if ambiguous, <0.5 if likely wrong

LISTINGS:
${items.join("\n\n")}

Return ONLY the JSON array. No commentary.`;
}

/* ── Batch processing ────────────────────────────────────── */

/**
 * Send a batch of listings to Gemini for review.
 * Returns an array of verdicts.
 */
export async function reviewBatch(listings: ListingForReview[]): Promise<BatchResult> {
  const prompt = buildBatchPrompt(listings);
  const response = await callGemini(prompt);

  let parsed: unknown;
  try {
    parsed = parseGeminiJson(response.text);
  } catch {
    // If parseGeminiJson returns an object but we need an array,
    // try direct JSON parse after stripping fences
    const cleaned = response.text
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  }

  // Handle both array and object-with-array responses
  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.reviews)
      ? (parsed as Record<string, unknown>).reviews as unknown[]
      : Array.isArray((parsed as Record<string, unknown>)?.results)
        ? (parsed as Record<string, unknown>).results as unknown[]
        : [];

  const idSet = new Set(listings.map((l) => l.id));

  const verdicts: AiVerdict[] = arr
    .filter((v): v is Record<string, unknown> => v !== null && typeof v === "object")
    .filter((v) => typeof v.listingId === "string" && idSet.has(v.listingId as string))
    .map((v) => ({
      listingId: v.listingId as string,
      isResidential: v.isResidential === true,
      suggestedType: typeof v.suggestedType === "string" && VALID_TYPES.has(v.suggestedType as PropertyType)
        ? v.suggestedType
        : null,
      confidence: typeof v.confidence === "number" ? Math.max(0, Math.min(1, v.confidence)) : 0.5,
      reason: typeof v.reason === "string" ? v.reason.slice(0, 500) : "No reason provided",
    }));

  return { verdicts, tokenCount: response.tokenCount };
}

/* ── Determine if a verdict should be flagged ────────────── */

export function shouldFlag(verdict: AiVerdict, currentType: string): boolean {
  // Non-residential detected
  if (!verdict.isResidential) return true;

  // Type mismatch with high confidence
  if (
    verdict.suggestedType &&
    verdict.suggestedType !== currentType &&
    verdict.confidence >= 0.7
  ) return true;

  // Low confidence — needs human eyes
  if (verdict.confidence < 0.5) return true;

  return false;
}

/* ── Persist verdicts ────────────────────────────────────── */

export async function saveVerdicts(
  verdicts: AiVerdict[],
  listingTypes: Map<string, string>,
  tokenCount: number | null,
): Promise<{ saved: number; flagged: number }> {
  let flaggedCount = 0;

  const data = verdicts.map((v) => {
    const currentType = listingTypes.get(v.listingId) ?? "APARTMENT";
    const flagged = shouldFlag(v, currentType);
    if (flagged) flaggedCount++;

    return {
      listingId: v.listingId,
      isResidential: v.isResidential,
      suggestedType: v.suggestedType && VALID_TYPES.has(v.suggestedType as PropertyType)
        ? v.suggestedType as PropertyType
        : null,
      confidence: v.confidence,
      reason: v.reason,
      flagged,
      tokenCount: tokenCount ? Math.round(tokenCount / verdicts.length) : null,
    };
  });

  // Upsert: delete old reviews for these listings, then create new ones
  const listingIds = data.map((d) => d.listingId);
  await prisma.rentalAiReview.deleteMany({
    where: { listingId: { in: listingIds } },
  });
  await prisma.rentalAiReview.createMany({ data });

  return { saved: data.length, flagged: flaggedCount };
}

/* ── Main orchestrator ───────────────────────────────────── */

export interface ReviewOptions {
  /** Only review listings that haven't been AI-reviewed yet */
  unreviewed?: boolean;
  /** Maximum number of listings to review */
  limit?: number;
  /** Dry run — don't persist, just preview */
  dryRun?: boolean;
  /** Only review listings of a specific source */
  source?: string;
  /** Only re-review flagged listings */
  flaggedOnly?: boolean;
  /** Log function */
  log?: (msg: string) => void;
}

export async function runAiReview(options: ReviewOptions = {}): Promise<{
  reviewed: number;
  flagged: number;
  totalTokens: number;
}> {
  const log = options.log ?? console.log;

  // Validate API key first
  validateGeminiKey();

  // Build query
  const where: Record<string, unknown> = { isActive: true };

  if (options.source) {
    where.source = options.source;
  }

  if (options.unreviewed) {
    where.aiReviews = { none: {} };
  }

  if (options.flaggedOnly) {
    where.aiReviews = { some: { flagged: true } };
  }

  const listings = await prisma.rentalListing.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      propertyType: true,
      priceMonthlyUsd: true,
      bedrooms: true,
      district: true,
      canonicalUrl: true,
    },
    orderBy: { lastSeenAt: "desc" },
    take: options.limit ?? 10000,
  });

  log(`Found ${listings.length} listings to review`);
  if (listings.length === 0) return { reviewed: 0, flagged: 0, totalTokens: 0 };

  // Build type map for flagging logic
  const typeMap = new Map(listings.map((l) => [l.id, l.propertyType]));

  // Process in batches
  const batches: ListingForReview[][] = [];
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    batches.push(listings.slice(i, i + BATCH_SIZE));
  }

  let totalReviewed = 0;
  let totalFlagged = 0;
  let totalTokens = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log(`\n── Batch ${i + 1}/${batches.length} (${batch.length} listings) ──`);

    try {
      const { verdicts, tokenCount } = await reviewBatch(batch);
      totalTokens += tokenCount ?? 0;

      if (verdicts.length === 0) {
        log("  ⚠ No valid verdicts returned by Gemini");
        continue;
      }

      // Print verdicts
      for (const v of verdicts) {
        const listing = batch.find((l) => l.id === v.listingId);
        const currentType = typeMap.get(v.listingId) ?? "?";
        const flag = shouldFlag(v, currentType);
        const prefix = flag ? "🚩" : "✓";
        const typeStr = !v.isResidential
          ? "NON-RESIDENTIAL"
          : v.suggestedType !== currentType
            ? `${currentType} → ${v.suggestedType}`
            : currentType;

        log(
          `  ${prefix} [${(v.confidence * 100).toFixed(0)}%] ${typeStr.padEnd(28)} "${(listing?.title ?? "").slice(0, 55)}"`
        );
        if (flag) {
          log(`     Reason: ${v.reason}`);
        }
      }

      // Save to DB (unless dry run)
      if (!options.dryRun) {
        const { saved, flagged } = await saveVerdicts(verdicts, typeMap, tokenCount);
        totalReviewed += saved;
        totalFlagged += flagged;
        log(`  → Saved ${saved} reviews (${flagged} flagged)`);
      } else {
        totalReviewed += verdicts.length;
        totalFlagged += verdicts.filter((v) => shouldFlag(v, typeMap.get(v.listingId) ?? "")).length;
        log(`  → [DRY RUN] Would save ${verdicts.length} reviews`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ✗ Batch failed: ${msg}`);
    }

    // Rate limit between batches (Gemini free tier: 15 RPM)
    if (i < batches.length - 1) {
      log("  ⏳ Cooling down 4s...");
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  log(`\n╔══════════════════════════════════════════╗`);
  log(`║  AI Review Complete                      ║`);
  log(`╠══════════════════════════════════════════╣`);
  log(`║  Reviewed:    ${String(totalReviewed).padStart(6)} listings            ║`);
  log(`║  Flagged:     ${String(totalFlagged).padStart(6)} issues              ║`);
  log(`║  Tokens used: ${String(totalTokens).padStart(6)}                     ║`);
  log(`╚══════════════════════════════════════════╝`);

  return { reviewed: totalReviewed, flagged: totalFlagged, totalTokens };
}
