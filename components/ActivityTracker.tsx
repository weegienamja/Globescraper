"use client";

import { useEffect, useCallback } from "react";

const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes
const DEBOUNCE_MS = 30 * 1000; // Don't send more than once per 30s

/**
 * Invisible client component that tracks user activity.
 * Sends a heartbeat to /api/heartbeat on mount and then:
 *  - every 2 minutes while the tab is visible
 *  - on click / keydown / scroll (debounced)
 *  - when the tab regains visibility
 */
export function ActivityTracker() {
  const sendHeartbeat = useCallback(() => {
    // Fire-and-forget — don't block the UI
    fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    let lastSent = 0;

    function beat() {
      const now = Date.now();
      if (now - lastSent < DEBOUNCE_MS) return;
      lastSent = now;
      sendHeartbeat();
    }

    // Immediately register activity on mount
    beat();

    // Periodic heartbeat
    const interval = setInterval(beat, HEARTBEAT_INTERVAL);

    // User interaction events (passive — no perf impact)
    const events: (keyof WindowEventMap)[] = ["click", "keydown", "scroll", "mousemove"];
    for (const evt of events) {
      window.addEventListener(evt, beat, { passive: true });
    }

    // Tab visibility change
    function onVisibility() {
      if (document.visibilityState === "visible") beat();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      for (const evt of events) {
        window.removeEventListener(evt, beat);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sendHeartbeat]);

  return null; // Renders nothing — pure side-effect
}
