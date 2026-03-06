/**
 * TempChart — Interactive SVG timeseries line chart for temperature data.
 * Shows historical temps, projections, baseline, current year marker,
 * and a draggable vertical cursor with tooltip.
 */

"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import type { YearlyTemp } from "@/lib/api/openMeteo";

type Scenario = "optimistic" | "moderate" | "worst";

interface Props {
  yearly: YearlyTemp[];
  projections: Record<Scenario, YearlyTemp[]>;
  baseline: number;
  currentYear: number;
  scenario: Scenario;
}

const W = 320;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 28, left: 38 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const SCENARIO_COLORS: Record<Scenario, string> = {
  optimistic: "#44ff88",
  moderate: "#ffd700",
  worst: "#ff4444",
};

function anomalyColor(anomaly: number): string {
  if (anomaly <= -1.5) return "#08306b";
  if (anomaly <= -1) return "#2166ac";
  if (anomaly <= -0.5) return "#67a9cf";
  if (anomaly <= 0) return "#d1e5f0";
  if (anomaly <= 0.5) return "#fddbc7";
  if (anomaly <= 1) return "#ef8a62";
  if (anomaly <= 1.5) return "#d6604d";
  if (anomaly <= 2) return "#b2182b";
  if (anomaly <= 3) return "#a01020";
  return "#67001f";
}

export default function TempChart({ yearly, projections, baseline, currentYear, scenario }: Props) {
  const projData = projections[scenario] || [];
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  // Merge all data into a single lookup by year
  const allData = useMemo(() => {
    const map = new Map<number, YearlyTemp>();
    for (const y of yearly) map.set(y.year, y);
    for (const y of projData) if (!map.has(y.year)) map.set(y.year, y);
    return map;
  }, [yearly, projData]);

  const { minYear, maxYear, minTemp, maxTemp, xScale, yScale, xInverse } = useMemo(() => {
    const allTemps = [
      ...yearly.map(y => y.meanC),
      ...projData.map(y => y.meanC),
      baseline,
    ];
    const allYears = [
      ...yearly.map(y => y.year),
      ...projData.map(y => y.year),
    ];

    const minY = Math.min(...allYears);
    const maxY = Math.max(...allYears);
    const minT = Math.min(...allTemps) - 0.5;
    const maxT = Math.max(...allTemps) + 0.5;

    return {
      minYear: minY,
      maxYear: maxY,
      minTemp: minT,
      maxTemp: maxT,
      xScale: (year: number) => PAD.left + ((year - minY) / (maxY - minY)) * PLOT_W,
      yScale: (temp: number) => PAD.top + PLOT_H - ((temp - minT) / (maxT - minT)) * PLOT_H,
      xInverse: (px: number) => minY + ((px - PAD.left) / PLOT_W) * (maxY - minY),
    };
  }, [yearly, projData, baseline]);

  // Mouse/touch tracking for interactive cursor
  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < PAD.left || svgX > W - PAD.right) {
      setHoverYear(null);
      return;
    }
    const year = Math.round(xInverse(svgX));
    setHoverYear(year);
  }, [xInverse]);

  const handlePointerLeave = useCallback(() => {
    setHoverYear(null);
  }, []);

  // Tooltip data for hover year
  const hoverInfo = useMemo(() => {
    if (hoverYear === null) return null;
    const entry = allData.get(hoverYear);
    if (!entry) return null;
    const anomaly = entry.meanC - baseline;
    const isProjection = !yearly.some(y => y.year === hoverYear);
    return { year: hoverYear, temp: entry.meanC, anomaly, isProjection };
  }, [hoverYear, allData, baseline, yearly]);

  // Build historical line path with gradient segments
  const histSegments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    for (let i = 1; i < yearly.length; i++) {
      const prev = yearly[i - 1];
      const cur = yearly[i];
      const anomaly = ((prev.meanC + cur.meanC) / 2) - baseline;
      segs.push({
        x1: xScale(prev.year),
        y1: yScale(prev.meanC),
        x2: xScale(cur.year),
        y2: yScale(cur.meanC),
        color: anomalyColor(anomaly),
      });
    }
    return segs;
  }, [yearly, xScale, yScale, baseline]);

  // Build projection path
  const projPath = useMemo(() => {
    if (projData.length === 0) return "";
    const first = projData[0];
    let d = `M${xScale(first.year)},${yScale(first.meanC)}`;
    for (let i = 1; i < projData.length; i++) {
      d += ` L${xScale(projData[i].year)},${yScale(projData[i].meanC)}`;
    }
    return d;
  }, [projData, xScale, yScale]);

  // Connect historical to projection
  const connectorPath = useMemo(() => {
    if (yearly.length === 0 || projData.length === 0) return "";
    const lastHist = yearly[yearly.length - 1];
    const firstProj = projData[0];
    return `M${xScale(lastHist.year)},${yScale(lastHist.meanC)} L${xScale(firstProj.year)},${yScale(firstProj.meanC)}`;
  }, [yearly, projData, xScale, yScale]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxTemp - minTemp > 6 ? 2 : 1;
    const start = Math.ceil(minTemp / step) * step;
    for (let t = start; t <= maxTemp; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [minTemp, maxTemp]);

  // X-axis ticks (every 20 years)
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const start = Math.ceil(minYear / 20) * 20;
    for (let y = start; y <= maxYear; y += 20) {
      ticks.push(y);
    }
    return ticks;
  }, [minYear, maxYear]);

  // Current year position
  const curX = xScale(Math.min(Math.max(currentYear, minYear), maxYear));
  const baselineY = yScale(baseline);
  const showCurrentLine = currentYear >= minYear && currentYear <= maxYear;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", touchAction: "none", cursor: "crosshair" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Grid lines */}
      {yTicks.map(t => (
        <line
          key={`yg-${t}`}
          x1={PAD.left}
          y1={yScale(t)}
          x2={W - PAD.right}
          y2={yScale(t)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />
      ))}

      {/* Baseline reference */}
      <line
        x1={PAD.left}
        y1={baselineY}
        x2={W - PAD.right}
        y2={baselineY}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={0.8}
        strokeDasharray="4,3"
      />
      <text
        x={W - PAD.right + 2}
        y={baselineY + 3}
        fill="rgba(255,255,255,0.3)"
        fontSize={6}
        fontFamily="'Space Mono', monospace"
      >

      </text>

      {/* Historical line segments (colored by anomaly) */}
      {histSegments.map((seg, i) => (
        <line
          key={`h-${i}`}
          x1={seg.x1}
          y1={seg.y1}
          x2={seg.x2}
          y2={seg.y2}
          stroke={seg.color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}

      {/* Connector */}
      {connectorPath && (
        <path
          d={connectorPath}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      )}

      {/* Projection line */}
      {projPath && (
        <path
          d={projPath}
          fill="none"
          stroke={SCENARIO_COLORS[scenario]}
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.7}
        />
      )}

      {/* Current year indicator */}
      {showCurrentLine && (
        <>
          <line
            x1={curX}
            y1={PAD.top}
            x2={curX}
            y2={PAD.top + PLOT_H}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={0.8}
            strokeDasharray="3,2"
          />
          <text
            x={curX}
            y={PAD.top - 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize={7}
            fontFamily="'Space Mono', monospace"
          >
            {Math.round(currentYear)}
          </text>
        </>
      )}

      {/* Y-axis labels */}
      {yTicks.map(t => (
        <text
          key={`yl-${t}`}
          x={PAD.left - 4}
          y={yScale(t) + 3}
          textAnchor="end"
          fill="rgba(255,255,255,0.35)"
          fontSize={7}
          fontFamily="'Space Mono', monospace"
        >
          {t.toFixed(0)}°
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map(yr => (
        <text
          key={`xl-${yr}`}
          x={xScale(yr)}
          y={H - 4}
          textAnchor="middle"
          fill="rgba(255,255,255,0.35)"
          fontSize={7}
          fontFamily="'Space Mono', monospace"
        >
          {yr}
        </text>
      ))}

      {/* Axis lines */}
      <line
        x1={PAD.left}
        y1={PAD.top}
        x2={PAD.left}
        y2={PAD.top + PLOT_H}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.5}
      />
      <line
        x1={PAD.left}
        y1={PAD.top + PLOT_H}
        x2={W - PAD.right}
        y2={PAD.top + PLOT_H}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.5}
      />

      {/* Legend */}
      <line x1={PAD.left + 4} y1={H - 16} x2={PAD.left + 18} y2={H - 16} stroke="#ef8a62" strokeWidth={1.5} />
      <text x={PAD.left + 22} y={H - 13} fill="rgba(255,255,255,0.4)" fontSize={6}>Historical</text>

      <line x1={PAD.left + 70} y1={H - 16} x2={PAD.left + 84} y2={H - 16} stroke={SCENARIO_COLORS[scenario]} strokeWidth={1.5} strokeDasharray="3,2" />
      <text x={PAD.left + 88} y={H - 13} fill="rgba(255,255,255,0.4)" fontSize={6}>
        {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
      </text>

      <line x1={PAD.left + 150} y1={H - 16} x2={PAD.left + 164} y2={H - 16} stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} strokeDasharray="4,3" />
      <text x={PAD.left + 168} y={H - 13} fill="rgba(255,255,255,0.4)" fontSize={6}>Baseline</text>

      {/* Transparent overlay for pointer events */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={PLOT_W}
        height={PLOT_H}
        fill="transparent"
      />

      {/* Interactive cursor */}
      {hoverInfo && (() => {
        const hx = xScale(hoverInfo.year);
        const hy = yScale(hoverInfo.temp);
        const tooltipW = 76;
        const tooltipH = 38;
        // Flip tooltip to left side when near right edge
        const tooltipX = hx + tooltipW + 8 > W - PAD.right ? hx - tooltipW - 8 : hx + 8;
        const tooltipY = Math.max(PAD.top, Math.min(hy - tooltipH / 2, PAD.top + PLOT_H - tooltipH));
        return (
          <>
            {/* Vertical crosshair */}
            <line
              x1={hx} y1={PAD.top}
              x2={hx} y2={PAD.top + PLOT_H}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={0.6}
            />
            {/* Dot at data point */}
            <circle
              cx={hx} cy={hy}
              r={3}
              fill={hoverInfo.isProjection ? SCENARIO_COLORS[scenario] : anomalyColor(hoverInfo.anomaly)}
              stroke="white"
              strokeWidth={0.8}
            />
            {/* Tooltip background */}
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipW}
              height={tooltipH}
              rx={4}
              fill="rgba(0,0,0,0.85)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={0.5}
            />
            {/* Tooltip text */}
            <text x={tooltipX + 6} y={tooltipY + 12} fill="rgba(255,255,255,0.9)" fontSize={8} fontFamily="'Space Mono', monospace" fontWeight={700}>
              {hoverInfo.year}
            </text>
            <text x={tooltipX + 6} y={tooltipY + 22} fill="rgba(255,255,255,0.7)" fontSize={7} fontFamily="'Space Mono', monospace">
              {hoverInfo.temp.toFixed(1)}°C
            </text>
            <text x={tooltipX + 6} y={tooltipY + 32} fill={hoverInfo.anomaly >= 0 ? "#ff6644" : "#4488ff"} fontSize={7} fontFamily="'Space Mono', monospace">
              {hoverInfo.anomaly >= 0 ? "+" : ""}{hoverInfo.anomaly.toFixed(2)}°C vs baseline
            </text>
          </>
        );
      })()}
    </svg>
  );
}
