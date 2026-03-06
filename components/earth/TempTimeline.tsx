/**
 * TempTimeline — Colour-graded temperature bar (warming stripes style)
 * Each year is a vertical stripe: blue (cool) → red (warm), relative to baseline.
 */

"use client";

import { useMemo } from "react";
import type { YearlyTemp } from "@/lib/api/openMeteo";

interface Props {
  yearly: YearlyTemp[];
  baseline: number;
  currentYear: number;
  projections?: YearlyTemp[];
  label?: string;
}

function anomalyColor(anomalyC: number): string {
  // Blue → White → Yellow → Orange → Red → DarkRed
  // -2°C → 0°C → +1°C → +2°C → +3°C → +5°C
  const t = anomalyC;
  if (t <= -2) return "rgb(8, 48, 107)";       // deep blue
  if (t <= -1) return "rgb(33, 102, 172)";      // blue
  if (t <= 0)  return "rgb(146, 197, 222)";     // light blue
  if (t <= 0.5) return "rgb(244, 244, 244)";    // near white
  if (t <= 1)  return "rgb(253, 219, 136)";     // yellow
  if (t <= 2)  return "rgb(244, 165, 56)";      // orange
  if (t <= 3)  return "rgb(214, 96, 77)";       // red-orange
  if (t <= 4)  return "rgb(178, 24, 43)";       // red
  return "rgb(103, 0, 31)";                      // dark red
}

export default function TempTimeline({ yearly, baseline, currentYear, projections, label }: Props) {
  const combined = useMemo(() => {
    const all = [...yearly];
    if (projections) {
      for (const p of projections) {
        if (!all.find(y => y.year === p.year)) {
          all.push(p);
        }
      }
    }
    return all.sort((a, b) => a.year - b.year);
  }, [yearly, projections]);

  if (combined.length === 0) return null;

  const minYear = combined[0].year;
  const maxYear = combined[combined.length - 1].year;

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 4, letterSpacing: "0.05em" }}>
          {label}
        </div>
      )}

      {/* Warming stripes */}
      <div
        style={{
          display: "flex",
          height: 32,
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
          cursor: "crosshair",
        }}
        title={`${minYear}–${maxYear} | Baseline: ${baseline.toFixed(1)}°C`}
      >
        {combined.map((entry, i) => {
          const anomaly = entry.meanC - baseline;
          const isProjection = entry.year > 2024;
          const isCurrent = entry.year === Math.round(currentYear);
          return (
            <div
              key={entry.year}
              style={{
                flex: 1,
                background: anomalyColor(anomaly),
                opacity: isProjection ? 0.6 : 1,
                borderLeft: isCurrent ? "2px solid white" : "none",
                borderRight: isCurrent ? "2px solid white" : "none",
                position: "relative",
              }}
              title={`${entry.year}: ${entry.meanC.toFixed(1)}°C (${anomaly >= 0 ? "+" : ""}${anomaly.toFixed(1)}°C)`}
            />
          );
        })}
      </div>

      {/* Year labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 8, opacity: 0.4 }}>{minYear}</span>
        <span style={{ fontSize: 8, opacity: 0.4 }}>{maxYear}</span>
      </div>
    </div>
  );
}
