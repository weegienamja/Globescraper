"use client";

import { useEffect, useRef } from "react";

/** Invisible anchor – scrolls to the bottom of the chat on mount. */
export function ChatScrollAnchor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return <div ref={ref} aria-hidden="true" />;
}
