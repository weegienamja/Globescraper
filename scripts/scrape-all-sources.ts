/**
 * Multi-source parallel scraper launcher.
 *
 * Runs multiple scraper scripts in parallel, each targeting a different
 * source. The queue claiming is atomic (SQL UPDATE…LIMIT) so even within
 * a single source, multiple workers can run safely.
 *
 * Usage:
 *   npx tsx scripts/scrape-all-sources.ts
 *   npx tsx scripts/scrape-all-sources.ts --workers 3
 *   npx tsx scripts/scrape-all-sources.ts --process-only
 *
 * --workers N   Spawn N parallel workers PER SOURCE (default: 1)
 * --process-only   Skip discovery, only process existing queue items
 */

import { execFile } from "child_process";
import path from "path";

const hasFlag = (name: string) => process.argv.includes(name);
function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}

const WORKERS = getArg("--workers", 1);
const PROCESS_ONLY = hasFlag("--process-only");

interface SourceConfig {
  label: string;
  script: string;
  extraArgs?: string[];
}

const SOURCES: SourceConfig[] = [
  {
    label: "Realestate.com.kh (Full)",
    script: "scrape-realestate-full.ts",
    extraArgs: ["--workers", String(WORKERS)],
  },
  {
    label: "Realestate.com.kh (Daily)",
    script: "realestate-daily.ts",
  },
];

function runScript(src: SourceConfig): Promise<{ label: string; ok: boolean }> {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(__dirname, src.script);
    const args = [scriptPath];
    if (PROCESS_ONLY) args.push("--process-only");
    if (src.extraArgs) args.push(...src.extraArgs);

    const tag = src.label.slice(0, 20).padEnd(20);

    console.log(`[${tag}] Starting...`);

    const child = execFile("npx", ["tsx", ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: 50 * 1024 * 1024,
    }, (err) => {
      if (err) {
        console.error(`[${tag}] FAILED: ${err.message}`);
        resolve({ label: src.label, ok: false });
      } else {
        console.log(`[${tag}] DONE`);
        resolve({ label: src.label, ok: true });
      }
    });

    child.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().trimEnd().split("\n")) {
        console.log(`[${tag}] ${line}`);
      }
    });
    child.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().trimEnd().split("\n")) {
        console.error(`[${tag}] ${line}`);
      }
    });
  });
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Multi-Source Parallel Scraper                ║");
  console.log(`║  Sources: ${SOURCES.length}  Workers per source: ${WORKERS}          ║`);
  console.log("╚══════════════════════════════════════════════╝\n");

  const start = Date.now();
  const results = await Promise.allSettled(SOURCES.map(runScript));

  const succeeded = results.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
  const failed = SOURCES.length - succeeded;
  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

  console.log(`\n✔ All sources done in ${elapsed} minutes — ${succeeded} succeeded, ${failed} failed`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
