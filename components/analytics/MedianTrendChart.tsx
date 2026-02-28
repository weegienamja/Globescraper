"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";

/* ── Types ───────────────────────────────────────────────── */

interface TrendPoint {
  date: string;
  median: number | null;
  mean: number | null;
  p25: number | null;
  p75: number | null;
  listingCount: number;
  ma90: number | null;
}

interface Props {
  data: TrendPoint[];
}

type BarMetric = "median" | "p25" | "p75" | "mean";

/* ── Component ───────────────────────────────────────────── */

export function MedianTrendChart({ data }: Props) {
  const [barMetric, setBarMetric] = useState<BarMetric>("median");
  const [showMa, setShowMa] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const getVal = (p: TrendPoint): number | null => {
    switch (barMetric) {
      case "median": return p.median;
      case "p25": return p.p25;
      case "p75": return p.p75;
      case "mean": return p.mean;
    }
  };

  // Aggregate to monthly buckets for cleaner chart
  const monthly = useMemo(() => {
    const months = new Map<string, { values: number[]; ma90s: number[]; label: string }>();
    for (const p of data) {
      const ym = p.date.slice(0, 7);
      if (!months.has(ym)) months.set(ym, { values: [], ma90s: [], label: ym });
      const v = getVal(p);
      if (v !== null) months.get(ym)!.values.push(v);
      if (p.ma90 !== null) months.get(ym)!.ma90s.push(p.ma90);
    }
    return Array.from(months.values()).map((m) => ({
      label: m.label,
      value:
        m.values.length > 0
          ? Math.round(m.values.reduce((a, b) => a + b, 0) / m.values.length)
          : null,
      ma90:
        m.ma90s.length > 0
          ? Math.round(m.ma90s.reduce((a, b) => a + b, 0) / m.ma90s.length)
          : null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, barMetric]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || monthly.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = 280;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // Paddings
    const PL = 60;
    const PR = 20;
    const PT = 20;
    const PB = 50;
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Data range
    const values = monthly.map((m) => m.value).filter((v): v is number => v !== null);
    const ma90Vals = monthly.map((m) => m.ma90).filter((v): v is number => v !== null);
    const allVals = [...values, ...ma90Vals];
    if (allVals.length === 0) return;

    const maxVal = Math.max(...allVals) * 1.1;
    const minVal = Math.min(0, Math.min(...allVals) * 0.9);

    // Y scale
    const yScale = (v: number) => PT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    // Grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const v = minVal + ((maxVal - minVal) * i) / gridSteps;
      const y = yScale(v);
      ctx.beginPath();
      ctx.moveTo(PL, y);
      ctx.lineTo(W - PR, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = "#64748b";
      ctx.font = "11px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`$${Math.round(v).toLocaleString()}`, PL - 8, y + 4);
      ctx.setLineDash([4, 4]);
    }
    ctx.setLineDash([]);

    // Bars
    const barCount = monthly.length;
    const gap = 4;
    const barW = Math.max(4, (chartW - gap * (barCount + 1)) / barCount);
    const barGap = (chartW - barW * barCount) / (barCount + 1);

    for (let i = 0; i < barCount; i++) {
      const m = monthly[i];
      if (m.value === null) continue;
      const x = PL + barGap + i * (barW + barGap);
      const y = yScale(m.value);
      const barH = yScale(minVal) - y;

      // Gradient-like solid bar
      const color = m.value < 300 ? "#22c55e" : m.value < 600 ? "#3b82f6" : m.value < 1000 ? "#f59e0b" : "#ef4444";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      const radius = Math.min(3, barW / 2);
      if (barH > radius) {
        ctx.moveTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
        ctx.lineTo(x + barW, y + barH);
        ctx.lineTo(x, y + barH);
      } else {
        ctx.rect(x, y, barW, barH);
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // X labels
      if (barCount <= 12 || i % Math.ceil(barCount / 12) === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(x + barW / 2, H - PB + 12);
        ctx.rotate(-0.5);
        ctx.fillText(m.label, 0, 0);
        ctx.restore();
      }
    }

    // MA90 line
    if (showMa) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < barCount; i++) {
        const m = monthly[i];
        if (m.ma90 === null) continue;
        const x = PL + barGap + i * (barW + barGap) + barW / 2;
        const y = yScale(m.ma90);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // MA label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("90-day MA", W - PR - 70, PT + 14);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(W - PR - 78, PT + 11);
      ctx.lineTo(W - PR - 72, PT + 11);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [monthly, showMa]);

  // Tooltip handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip) return;

    const PL = 60;
    const PR = 20;
    const chartW = canvas.getBoundingClientRect().width - PL - PR;
    const barCount = monthly.length;
    const barW = Math.max(4, (chartW - 4 * (barCount + 1)) / barCount);
    const barGap = (chartW - barW * barCount) / (barCount + 1);

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - PL;
      const idx = Math.floor(mx / (barW + barGap));
      if (idx >= 0 && idx < monthly.length && monthly[idx].value !== null) {
        const m = monthly[idx];
        tooltip.style.display = "block";
        tooltip.style.left = `${e.clientX - rect.left}px`;
        tooltip.style.top = `${e.clientY - rect.top - 40}px`;
        tooltip.innerHTML = `<strong>${m.label}</strong><br/>$${m.value!.toLocaleString()}/mo${m.ma90 !== null ? `<br/>MA90: $${m.ma90.toLocaleString()}` : ""}`;
      } else {
        tooltip.style.display = "none";
      }
    };
    const handleLeave = () => {
      tooltip.style.display = "none";
    };
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", handleLeave);
    return () => {
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", handleLeave);
    };
  }, [monthly]);

  if (data.length === 0) {
    return (
      <div style={{ height: 280, background: "rgba(15,23,42,0.4)", borderRadius: 12, border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>No trend data available.</p>
      </div>
    );
  }

  const toggleGroupStyle: React.CSSProperties = {
    display: "flex",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0f172a",
    padding: 2,
  };
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
    background: active ? "#334155" : "transparent",
    color: active ? "#e2e8f0" : "#64748b",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div style={toggleGroupStyle}>
          {(["median", "mean", "p25", "p75"] as BarMetric[]).map((m) => (
            <button key={m} onClick={() => setBarMetric(m)} style={toggleBtn(barMetric === m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showMa}
            onChange={(e) => setShowMa(e.target.checked)}
          />
          90-day MA
        </label>
      </div>
      <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
        <canvas ref={canvasRef} style={{ width: "100%" }} />
        <div
          ref={tooltipRef}
          style={{
            pointerEvents: "none",
            position: "absolute",
            zIndex: 50,
            display: "none",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#0f172a",
            padding: "8px 12px",
            fontSize: 11,
            color: "#e2e8f0",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            transform: "translate(-50%, -100%)",
          }}
        />
      </div>
    </div>
  );
}
