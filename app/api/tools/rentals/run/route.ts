/**
 * POST /api/tools/rentals/run?job=discover|process-queue|build-index&source=REALESTATE_KH
 *
 * Streaming SSE endpoint that runs a pipeline job and sends real-time
 * log events. The dashboard connects here to show live progress.
 *
 * Events:
 *   data: { timestamp, level, stage, message, meta }   — log entry
 *   event: complete\ndata: { ...result }               — job finished
 *   event: error\ndata: { error: "..." }               — job failed
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/rentals/api-guard";
import { discoverListingsJob } from "@/lib/rentals/jobs/discover";
import { processQueueJob } from "@/lib/rentals/jobs/processQueue";
import { buildDailyIndexJob } from "@/lib/rentals/jobs/buildIndex";
import { RentalSource } from "@prisma/client";
import type { PipelineLogFn, PipelineLogEntry, PipelineProgressFn, PipelineProgressEntry } from "@/lib/rentals/pipelineLogger";

const VALID_SOURCES = new Set<string>(["KHMER24", "REALESTATE_KH"]);
const VALID_JOBS = new Set<string>(["discover", "process-queue", "build-index", "run-all"]);

/** Allow longer execution for streaming jobs on Vercel */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const job = req.nextUrl.searchParams.get("job");
  const source = req.nextUrl.searchParams.get("source");

  if (!job || !VALID_JOBS.has(job)) {
    return NextResponse.json(
      { error: "Invalid job. Use ?job=discover|process-queue|build-index|run-all" },
      { status: 400 }
    );
  }

  if (job !== "build-index" && job !== "run-all" && (!source || !VALID_SOURCES.has(source))) {
    return NextResponse.json(
      { error: "Invalid source. Use ?source=KHMER24 or ?source=REALESTATE_KH" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      /** Send an SSE-formatted event */
      const send = (event: string, data: unknown) => {
        try {
          const payload =
            event === "log"
              ? `data: ${JSON.stringify(data)}\n\n`
              : `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* stream closed */
        }
      };

      /** Create a log function scoped to a stage */
      const makeLog = (stage: string): PipelineLogFn => (level, message, meta) => {
        const entry: PipelineLogEntry = {
          timestamp: new Date().toISOString(),
          level,
          stage,
          message,
          meta,
        };
        send("log", entry);
      };

      /**
       * Create a progress callback.
       * For run-all, remap per-phase % to an overall range.
       */
      const makeProgress = (
        overallStart = 0,
        overallEnd = 100
      ): PipelineProgressFn => (p: PipelineProgressEntry) => {
        const range = overallEnd - overallStart;
        const overall = Math.round(overallStart + (p.percent / 100) * range);
        send("progress", { phase: p.phase, percent: overall, label: p.label });
      };

      /** Run the appropriate job */
      (async () => {
        try {
          let result: unknown;
          switch (job) {
            case "discover":
              result = await discoverListingsJob(
                source as RentalSource,
                undefined,
                makeLog("discover"),
                makeProgress()
              );
              break;
            case "process-queue":
              result = await processQueueJob(
                source as RentalSource,
                undefined,
                makeLog("process"),
                makeProgress()
              );
              break;
            case "build-index": {
              const log = makeLog("index");
              const progress = makeProgress();
              /* Build for today AND yesterday so freshly-scraped data appears */
              const now = new Date();
              const todayUTC = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
              );
              log("info", `Building index for today (${todayUTC.toISOString().slice(0, 10)}) …`);
              const todayResult = await buildDailyIndexJob({ date: todayUTC }, log, progress);
              log("info", "Building index for yesterday …");
              const yesterdayResult = await buildDailyIndexJob(undefined, log, progress);
              result = { today: todayResult, yesterday: yesterdayResult };
              break;
            }
            case "run-all": {
              /* Chain all three phases: discover → process → build-index */
              const src = (source || "REALESTATE_KH") as RentalSource;

              // Phase 1: Discover (0-15%)
              const discoverLog = makeLog("discover");
              const discoverProgress = makeProgress(0, 15);
              discoverLog("info", "━━━ Phase 1/3: Discover ━━━");
              const discoverResult = await discoverListingsJob(
                src,
                undefined,
                discoverLog,
                discoverProgress
              );

              // Phase 2: Process Queue (15-85%)
              const processLog = makeLog("process");
              const processProgress = makeProgress(15, 85);
              processLog("info", "━━━ Phase 2/3: Process Queue ━━━");
              const processResult = await processQueueJob(
                src,
                undefined,
                processLog,
                processProgress
              );

              // Phase 3: Build Index (85-100%)
              const indexLog = makeLog("index");
              const indexProgress = makeProgress(85, 100);
              indexLog("info", "━━━ Phase 3/3: Build Index ━━━");
              const now = new Date();
              const todayUTC = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
              );
              indexLog("info", `Building index for today (${todayUTC.toISOString().slice(0, 10)}) …`);
              const todayResult = await buildDailyIndexJob({ date: todayUTC }, indexLog, indexProgress);
              indexLog("info", "Building index for yesterday …");
              const yesterdayResult = await buildDailyIndexJob(undefined, indexLog, indexProgress);

              result = {
                discover: discoverResult,
                process: processResult,
                index: { today: todayResult, yesterday: yesterdayResult },
              };
              break;
            }
          }
          send("complete", result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send("error", { error: msg });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
