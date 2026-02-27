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
import type { PipelineLogFn, PipelineLogEntry } from "@/lib/rentals/pipelineLogger";

const VALID_SOURCES = new Set<string>(["KHMER24", "REALESTATE_KH"]);
const VALID_JOBS = new Set<string>(["discover", "process-queue", "build-index"]);

/** Allow longer execution for streaming jobs on Vercel */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const job = req.nextUrl.searchParams.get("job");
  const source = req.nextUrl.searchParams.get("source");

  if (!job || !VALID_JOBS.has(job)) {
    return NextResponse.json(
      { error: "Invalid job. Use ?job=discover|process-queue|build-index" },
      { status: 400 }
    );
  }

  if (job !== "build-index" && (!source || !VALID_SOURCES.has(source))) {
    return NextResponse.json(
      { error: "Invalid source. Use ?source=KHMER24 or ?source=REALESTATE_KH" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      /** Send an SSE-formatted log entry */
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

      /** Stage name for log entries */
      const stage =
        job === "discover"
          ? "discover"
          : job === "process-queue"
          ? "process"
          : "index";

      /** Logger that writes to the SSE stream */
      const log: PipelineLogFn = (level, message, meta) => {
        const entry: PipelineLogEntry = {
          timestamp: new Date().toISOString(),
          level,
          stage,
          message,
          meta,
        };
        send("log", entry);
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
                log
              );
              break;
            case "process-queue":
              result = await processQueueJob(
                source as RentalSource,
                undefined,
                log
              );
              break;
            case "build-index":
              result = await buildDailyIndexJob(undefined, log);
              break;
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
