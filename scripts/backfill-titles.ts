/**
 * Backfill titleRewritten for all existing active listings.
 * - GPS listings: reverse geocode via Nominatim (1 req/sec)
 * - No-GPS listings: fallback from district/city (instant)
 *
 * Usage: npx tsx scripts/backfill-titles.ts [--limit N] [--force]
 */

import { runTitleGeocoding } from "../lib/rentals/title-geocode";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 500 : 10000;

  console.log(`\nBackfilling titles (limit: ${limit}, force: ${force})\n`);

  const result = await runTitleGeocoding({
    limit,
    force,
    geoOnly: false,
    dryRun: false,
    log: console.log,
  });

  console.log(`\nDone. Titled: ${result.titled}, Geocoded: ${result.geocoded}, Fallback: ${result.fallback}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
