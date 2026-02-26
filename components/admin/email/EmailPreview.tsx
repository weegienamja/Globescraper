"use client";

import { useState } from "react";

/**
 * EmailPreview: Desktop/mobile preview toggle for rendered email HTML.
 */

interface Props {
  html: string;
}

type ViewMode = "desktop" | "mobile";

export function EmailPreview({ html }: Props) {
  const [mode, setMode] = useState<ViewMode>("desktop");
  const width = mode === "desktop" ? 640 : 360;

  return (
    <div className="em-email-preview">
      <div className="em-email-preview__toolbar">
        <span className="em-email-preview__label">Preview</span>
        <div className="em-email-preview__modes">
          <button
            className={`em-email-preview__mode-btn ${mode === "desktop" ? "em-email-preview__mode-btn--active" : ""}`}
            onClick={() => setMode("desktop")}
          >
            &#128187; Desktop
          </button>
          <button
            className={`em-email-preview__mode-btn ${mode === "mobile" ? "em-email-preview__mode-btn--active" : ""}`}
            onClick={() => setMode("mobile")}
          >
            &#128241; Mobile
          </button>
        </div>
      </div>
      <div
        className="em-email-preview__frame-wrap"
        style={{ display: "flex", justifyContent: "center" }}
      >
        <iframe
          title="Email preview"
          srcDoc={html}
          className="em-email-preview__iframe"
          style={{
            width: `${width}px`,
            maxWidth: "100%",
            height: "700px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "#fff",
          }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
