"use client";

import React, { useRef, useEffect } from "react";

/* ── Types ───────────────────────────────────────────────── */

interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

interface Props {
  data: Bucket[];
}

/* ── Component ───────────────────────────────────────────── */

export function DistributionChart({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = 240;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const PL = 50;
    const PR = 20;
    const PT = 20;
    const PB = 60;
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    ctx.clearRect(0, 0, W, H);

    const maxPct = Math.max(...data.map((d) => d.percentage), 1) * 1.15;

    const yScale = (v: number) => PT + chartH - (v / maxPct) * chartH;

    // Grid
    ctx.strokeStyle = "#1e293b";
    ctx.setLineDash([4, 4]);
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = (maxPct * i) / steps;
      const y = yScale(v);
      ctx.beginPath();
      ctx.moveTo(PL, y);
      ctx.lineTo(W - PR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(v)}%`, PL - 6, y + 4);
      ctx.setLineDash([4, 4]);
    }
    ctx.setLineDash([]);

    // Bars
    const gap = 12;
    const barW = (chartW - gap * (data.length + 1)) / data.length;

    const COLORS = ["#22c55e", "#3b82f6", "#6366f1", "#f59e0b", "#ef4444"];

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const x = PL + gap + i * (barW + gap);
      const y = yScale(d.percentage);
      const barH = yScale(0) - y;
      const color = COLORS[i % COLORS.length];

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      const r = Math.min(4, barW / 2);
      ctx.beginPath();
      if (barH > r) {
        ctx.moveTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.arcTo(x + barW, y, x + barW, y + r, r);
        ctx.lineTo(x + barW, y + barH);
        ctx.lineTo(x, y + barH);
      } else {
        ctx.rect(x, y, barW, Math.max(barH, 1));
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // Value label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${d.percentage.toFixed(1)}%`, x + barW / 2, y - 6);

      // Count label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.fillText(`(${d.count})`, x + barW / 2, y - 18);

      // X label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(x + barW / 2, H - PB + 14);
      ctx.fillText(d.label, 0, 0);
      ctx.restore();
    }
  }, [data]);

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div style={{ height: 240, background: "rgba(15,23,42,0.4)", borderRadius: 12, border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>No distribution data.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas ref={canvasRef} style={{ width: "100%" }} />
    </div>
  );
}
