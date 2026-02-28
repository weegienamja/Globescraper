"use client";

import React, { useRef, useEffect, useMemo } from "react";

/* ── Types ───────────────────────────────────────────────── */

interface TrendPoint {
  date: string;
  median: number | null;
  listingCount: number;
}

interface Props {
  data: TrendPoint[];
  supplySignal: "oversupply" | "squeeze" | "neutral";
}

const SIGNAL_LABELS: Record<string, { text: string; color: string }> = {
  oversupply: { text: "Supply Expansion", color: "#ef4444" },
  squeeze: { text: "Demand Squeeze", color: "#f59e0b" },
  neutral: { text: "Stable Market", color: "#22c55e" },
};

/* ── Component ───────────────────────────────────────────── */

export function MarketPressureChart({ data, supplySignal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Monthly aggregation for cleanliness
  const monthly = useMemo(() => {
    const months = new Map<string, { medians: number[]; counts: number[] }>();
    for (const p of data) {
      const ym = p.date.slice(0, 7);
      if (!months.has(ym)) months.set(ym, { medians: [], counts: [] });
      const m = months.get(ym)!;
      if (p.median !== null) m.medians.push(p.median);
      m.counts.push(p.listingCount);
    }
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, { medians, counts }]) => ({
        label,
        median:
          medians.length > 0
            ? Math.round(medians.reduce((a, b) => a + b, 0) / medians.length)
            : null,
        count: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      }));
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || monthly.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.getBoundingClientRect().width;
    const H = 260;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const PL = 60;
    const PR = 60;
    const PT = 20;
    const PB = 50;
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    ctx.clearRect(0, 0, W, H);

    // Range
    const medians = monthly.map((m) => m.median).filter((v): v is number => v !== null);
    const counts = monthly.map((m) => m.count);
    if (medians.length === 0) return;

    const maxM = Math.max(...medians) * 1.1;
    const minM = Math.min(...medians) * 0.9;
    const maxC = Math.max(...counts) * 1.2;

    const yM = (v: number) => PT + chartH - ((v - minM) / (maxM - minM)) * chartH;
    const yC = (v: number) => PT + chartH - (v / maxC) * chartH;
    const xScale = (i: number) => PL + (i / (monthly.length - 1)) * chartW;

    // Grid
    ctx.strokeStyle = "#1e293b";
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const v = minM + ((maxM - minM) * i) / 4;
      const y = yM(v);
      ctx.beginPath();
      ctx.moveTo(PL, y);
      ctx.lineTo(W - PR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`$${Math.round(v)}`, PL - 6, y + 4);
      ctx.setLineDash([4, 4]);
    }
    ctx.setLineDash([]);

    // Right axis (count)
    for (let i = 0; i <= 4; i++) {
      const v = (maxC * i) / 4;
      const y = yC(v);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.round(v)}`, W - PR + 6, y + 4);
    }

    // Listing count area
    ctx.fillStyle = "rgba(99,102,241,0.12)";
    ctx.beginPath();
    ctx.moveTo(xScale(0), yC(0));
    for (let i = 0; i < monthly.length; i++) {
      ctx.lineTo(xScale(i), yC(monthly[i].count));
    }
    ctx.lineTo(xScale(monthly.length - 1), yC(0));
    ctx.closePath();
    ctx.fill();

    // Listing count line
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < monthly.length; i++) {
      const x = xScale(i);
      const y = yC(monthly[i].count);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Median line
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < monthly.length; i++) {
      if (monthly[i].median === null) continue;
      const x = xScale(i);
      const y = yM(monthly[i].median!);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Dots on median
    for (let i = 0; i < monthly.length; i++) {
      if (monthly[i].median === null) continue;
      const x = xScale(i);
      const y = yM(monthly[i].median!);
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // X labels
    for (let i = 0; i < monthly.length; i++) {
      if (monthly.length > 6 && i % Math.ceil(monthly.length / 6) !== 0 && i !== monthly.length - 1) continue;
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(monthly[i].label, xScale(i), H - PB + 14);
    }

    // Legend
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(PL, H - 14, 12, 3);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Median", PL + 16, H - 10);

    ctx.fillStyle = "#6366f1";
    ctx.fillRect(PL + 80, H - 14, 12, 3);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Listing Count", PL + 96, H - 10);
  }, [monthly]);

  const signal = SIGNAL_LABELS[supplySignal];

  if (data.length === 0) {
    return (
      <div style={{ height: 260, background: "rgba(15,23,42,0.4)", borderRadius: 12, border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>No pressure data available.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            display: "inline-block",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            background: signal.color + "18",
            color: signal.color,
            border: `1px solid ${signal.color}33`,
          }}
        >
          {signal.text}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          Median rent vs listing volume over time
        </span>
      </div>
      <div ref={containerRef} style={{ width: "100%" }}>
        <canvas ref={canvasRef} style={{ width: "100%" }} />
      </div>
    </div>
  );
}
