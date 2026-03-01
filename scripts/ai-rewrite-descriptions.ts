/**
 * AI Rewrite Descriptions — CLI Script
 *
 * Uses Gemini to rewrite listing descriptions to be professional,
 * uniform English while preserving all factual details.
 *
 * Usage:
 *   npx tsx scripts/ai-rewrite-descriptions.ts                  # dry run, unrewritten only
 *   npx tsx scripts/ai-rewrite-descriptions.ts --apply           # persist rewrites to DB
 *   npx tsx scripts/ai-rewrite-descriptions.ts --limit 50        # only first 50
 *   npx tsx scripts/ai-rewrite-descriptions.ts --source REALESTATE_KH
 *   npx tsx scripts/ai-rewrite-descriptions.ts --force           # re-rewrite already done
 *
 * Requires: GEMINI_API_KEY in .env / .env.local
 */

import * as fs from "fs";
import * as path from "path";

/** Lightweight .env loader (no dependency needed). */
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", ".env.local"));

import { runAiRewrite } from "../lib/rentals/ai-rewrite";
import { prisma } from "../lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const force = args.includes("--force");

  const limitIdx = args.indexOf("--limit");
  const limit =
    limitIdx !== -1 && args[limitIdx + 1]
      ? parseInt(args[limitIdx + 1], 10)
      : undefined;

  const sourceIdx = args.indexOf("--source");
  const source =
    sourceIdx !== -1 && args[sourceIdx + 1] ? args[sourceIdx + 1] : undefined;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Gemini AI Description Rewriter          ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(
    `║  Mode:   ${apply ? "APPLY" : "DRY RUN"}${" ".repeat(30 - (apply ? 5 : 7))}║`
  );
  if (limit) console.log(`║  Limit:  ${String(limit).padEnd(31)}║`);
  if (source) console.log(`║  Source: ${source.padEnd(31)}║`);
  if (force) console.log(`║  Force:  Re-rewrite already done          ║`);
  console.log("╚══════════════════════════════════════════╝\n");

  const result = await runAiRewrite({
    dryRun: !apply,
    unrewritten: !force,
    force,
    limit,
    source,
  });

  if (!apply) {
    console.log("\n💡 This was a dry run. To apply changes:");
    console.log("   npx tsx scripts/ai-rewrite-descriptions.ts --apply");
  }

  console.log(
    `\nDone. ${result.rewritten} descriptions rewritten, ${result.totalTokens} tokens used.`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
