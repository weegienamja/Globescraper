/**
 * Pipeline Logger
 *
 * Provides a callback-based logging mechanism for the rental pipeline.
 * Used to stream real-time progress from job functions to SSE endpoints.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface PipelineLogEntry {
  timestamp: string;
  level: LogLevel;
  stage: string;
  message: string;
  meta?: Record<string, unknown>;
}

/** Progress update sent as a separate SSE event for the progress bar. */
export interface PipelineProgressEntry {
  /** Which phase: discover | process | index */
  phase: string;
  /** 0-100 */
  percent: number;
  /** e.g. "Scraping 12/50 listings…" */
  label: string;
}

/**
 * Log function signature accepted by all pipeline jobs and adapters.
 * Pass this into any job/adapter to receive structured log events.
 */
export type PipelineLogFn = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
) => void;

/**
 * Progress reporting function. Jobs call this to update the progress bar.
 */
export type PipelineProgressFn = (progress: PipelineProgressEntry) => void;

/** No-op logger — used when no streaming is active */
export const noopLogger: PipelineLogFn = () => {};

/** No-op progress — used when no streaming is active */
export const noopProgress: PipelineProgressFn = () => {};
