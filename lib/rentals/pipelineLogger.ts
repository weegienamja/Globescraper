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

/**
 * Log function signature accepted by all pipeline jobs and adapters.
 * Pass this into any job/adapter to receive structured log events.
 */
export type PipelineLogFn = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
) => void;

/** No-op logger — used when no streaming is active */
export const noopLogger: PipelineLogFn = () => {};
