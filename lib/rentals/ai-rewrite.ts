/**
 * AI-powered description rewriter using Gemini.
 *
 * Batches 5–10 listings per Gemini call, rewrites descriptions to be
 * professional, uniform English while preserving all factual details.
 * Stores rewritten text in RentalListing.descriptionRewritten.
 *
 * Cost estimate (gemini-3-flash):
 *   10 listings × ~400 input tokens = ~4k input tokens/call
 *   10 listings × ~300 output tokens = ~3k output tokens/call
 *   3,000 listings ÷ 10/batch = 300 calls ≈ $0.05–0.15 per full run
 */

import { callGeminiText, validateGeminiKey } from "@/lib/ai/geminiClient";
import { prisma } from "@/lib/prisma";

/* ── Types ───────────────────────────────────────────────── */

export interface ListingForRewrite {
  id: string;
  title: string;
  description: string | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  priceMonthlyUsd: number | null;
  district: string | null;
  city: string;
}

interface RewriteResult {
  listingId: string;
  rewrittenTitle: string;
  rewritten: string;
}

interface BatchResult {
  results: RewriteResult[];
  tokenCount: number | null;
}

/* ── Constants ───────────────────────────────────────────── */

/** Smaller batches than review since descriptions are longer */
const BATCH_SIZE = 5;

/* ── Prompt ──────────────────────────────────────────────── */

function buildBatchPrompt(listings: ListingForRewrite[]): string {
  const items = listings.map((l, i) => {
    const desc = l.description
      ? l.description.slice(0, 800).trim()
      : "(no description)";
    return [
      `[LISTING_${l.id}]`,
      `Title: ${l.title}`,
      `Type: ${l.propertyType}`,
      `Location: ${l.district || "unknown"}, ${l.city}`,
      `Bedrooms: ${l.bedrooms ?? "unknown"} | Bathrooms: ${l.bathrooms ?? "unknown"} | Size: ${l.sizeSqm ? `${l.sizeSqm}sqm` : "unknown"}`,
      `Price: ${l.priceMonthlyUsd ? `$${l.priceMonthlyUsd}/mo` : "unknown"}`,
      `Original Description:`,
      desc,
      `[/LISTING_${l.id}]`,
    ].join("\n");
  });

  return `You are a professional property listing editor for Cambodia real estate.

For each listing below, rewrite BOTH the title and description.

TITLE rules:
- Format: "[Property Type] — [Key Feature] — [District], [City]" (e.g. "2-Bedroom Apartment — River View — BKK1, Phnom Penh")
- Short and scannable: max 80 characters
- Include bedroom count if available, property type, district/area
- Remove ALL CAPS, emojis, excessive punctuation, agent names, phone numbers
- Do NOT include price in the title
- If the original title is already clean and follows this format, keep it as-is

DESCRIPTION rules:
1. Clear, professional English — fix grammar, spelling, and awkward phrasing
2. Well-structured with key details first (property type, size, bedrooms, location)
3. Factually accurate — preserve ALL details from the original (prices, amenities, features, contact info)
4. Concise — remove excessive emojis, ALL CAPS shouting, and repetitive filler text
5. Uniform format across all listings
- Keep the same language tone (professional but warm, suitable for expat renters)
- Preserve specific details: exact prices, room counts, floor numbers, building names, addresses
- Convert confusing formatting (bullet points with emojis, mixed Khmer/English) into clean English paragraphs
- If the original mentions amenities (pool, gym, parking), list them clearly
- If the original is already good English, make minimal changes
- If description is empty or "(no description)", write a brief 2-sentence summary based on the title and metadata
- Do NOT invent details that aren't in the original
- Do NOT add marketing fluff or superlatives not in the original
- Maximum 200 words per description

Return your response in this EXACT format — one block per listing:

[LISTING_<id>]
TITLE: <rewritten title>
DESCRIPTION: <rewritten description>
[/LISTING_<id>]

LISTINGS TO REWRITE:

${items.join("\n\n")}

Return ONLY the rewritten blocks. No commentary, no preamble.`;
}

/* ── Parse response ──────────────────────────────────────── */

function parseRewriteResponse(
  responseText: string,
  listings: ListingForRewrite[]
): RewriteResult[] {
  const results: RewriteResult[] = [];
  const idSet = new Set(listings.map((l) => l.id));

  // Parse [LISTING_id]...[/LISTING_id] blocks
  const blockRegex = /\[LISTING_([^\]]+)\]\s*([\s\S]*?)\s*\[\/LISTING_\1\]/g;
  let match;

  while ((match = blockRegex.exec(responseText)) !== null) {
    const id = match[1];
    const content = match[2].trim();

    // Extract TITLE: and DESCRIPTION: from the block
    const titleMatch = content.match(/^TITLE:\s*(.+)/m);
    const descMatch = content.match(/DESCRIPTION:\s*([\s\S]*)/m);

    const rewrittenTitle = titleMatch ? titleMatch[1].trim() : "";
    const rewritten = descMatch ? descMatch[1].trim() : content;

    if (idSet.has(id) && rewritten.length > 10) {
      results.push({ listingId: id, rewrittenTitle, rewritten });
    }
  }

  return results;
}

/* ── Batch processing ────────────────────────────────────── */

export async function rewriteBatch(listings: ListingForRewrite[]): Promise<BatchResult> {
  const prompt = buildBatchPrompt(listings);
  const response = await callGeminiText(prompt);
  const results = parseRewriteResponse(response.text, listings);
  return { results, tokenCount: response.tokenCount };
}

/* ── Persist rewrites ────────────────────────────────────── */

export async function saveRewrites(results: RewriteResult[]): Promise<number> {
  const now = new Date();
  let saved = 0;

  for (const r of results) {
    const data: Record<string, unknown> = {
      descriptionRewritten: r.rewritten,
      descriptionRewrittenAt: now,
    };
    if (r.rewrittenTitle && r.rewrittenTitle.length > 5) {
      data.titleRewritten = r.rewrittenTitle;
    }
    await prisma.rentalListing.update({
      where: { id: r.listingId },
      data,
    });
    saved++;
  }

  return saved;
}

/* ── Main orchestrator ───────────────────────────────────── */

export interface RewriteOptions {
  /** Only rewrite listings that haven't been rewritten yet */
  unrewritten?: boolean;
  /** Maximum number of listings to rewrite */
  limit?: number;
  /** Dry run — don't persist, just preview */
  dryRun?: boolean;
  /** Only rewrite listings of a specific source */
  source?: string;
  /** Force re-rewrite even if already done */
  force?: boolean;
  /** Log function */
  log?: (msg: string) => void;
}

export async function runAiRewrite(options: RewriteOptions = {}): Promise<{
  rewritten: number;
  totalTokens: number;
}> {
  const log = options.log ?? console.log;

  validateGeminiKey();

  // Build query
  const where: Record<string, unknown> = { isActive: true };

  if (options.source) {
    where.source = options.source;
  }

  if (options.unrewritten && !options.force) {
    where.descriptionRewritten = null;
  }

  // Require at least some description to rewrite
  where.description = { not: null };

  const listings = await prisma.rentalListing.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      sizeSqm: true,
      priceMonthlyUsd: true,
      district: true,
      city: true,
    },
    orderBy: { lastSeenAt: "desc" },
    take: options.limit ?? 10000,
  });

  log(`Found ${listings.length} listings to rewrite`);
  if (listings.length === 0) return { rewritten: 0, totalTokens: 0 };

  // Process in batches
  const batches: ListingForRewrite[][] = [];
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    batches.push(listings.slice(i, i + BATCH_SIZE));
  }

  let totalRewritten = 0;
  let totalTokens = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log(`\n── Batch ${i + 1}/${batches.length} (${batch.length} listings) ──`);

    try {
      const { results, tokenCount } = await rewriteBatch(batch);
      totalTokens += tokenCount ?? 0;

      if (results.length === 0) {
        log("  ⚠ No valid rewrites returned by Gemini");
        continue;
      }

      // Print preview
      for (const r of results) {
        const listing = batch.find((l) => l.id === r.listingId);
        const origLen = listing?.description?.length ?? 0;
        log(
          `  ✓ "${(listing?.title ?? "").slice(0, 55)}" (${origLen} → ${r.rewritten.length} chars)`
        );
        // Show first 100 chars of rewrite
        log(`     ${r.rewritten.slice(0, 100)}...`);
      }

      // Missing listings
      const resultIds = new Set(results.map((r) => r.listingId));
      const missing = batch.filter((l) => !resultIds.has(l.id));
      if (missing.length > 0) {
        log(`  ⚠ ${missing.length} listing(s) not returned by Gemini`);
      }

      // Save (unless dry run)
      if (!options.dryRun) {
        const saved = await saveRewrites(results);
        totalRewritten += saved;
        log(`  → Saved ${saved} rewrites`);
      } else {
        totalRewritten += results.length;
        log(`  → [DRY RUN] Would save ${results.length} rewrites`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ✗ Batch failed: ${msg}`);
    }

    // Rate limit between batches (Gemini free tier: 15 RPM)
    if (i < batches.length - 1) {
      log("  ⏳ Cooling down 5s...");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  log(`\n╔══════════════════════════════════════════╗`);
  log(`║  AI Rewrite Complete                     ║`);
  log(`╠══════════════════════════════════════════╣`);
  log(`║  Rewritten:   ${String(totalRewritten).padStart(6)} descriptions        ║`);
  log(`║  Tokens used: ${String(totalTokens).padStart(6)}                     ║`);
  log(`╚══════════════════════════════════════════╝`);

  return { rewritten: totalRewritten, totalTokens };
}
