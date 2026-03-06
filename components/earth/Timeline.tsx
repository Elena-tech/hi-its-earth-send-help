"use client";

import { useRef, useCallback } from "react";
import { Scenario } from "@/lib/climateData";

const YEAR_MIN = 1850;
const YEAR_MAX = 2100;

interface Props {
  year: number;
  scenario: Scenario;
  onYearChange: (y: number) => void;
  onScenarioChange: (s: Scenario) => void;
}

const SCENARIOS: { key: Scenario; label: string; colour: string }[] = [
  { key: "optimistic", label: "SSP1-2.6 — Net zero by 2050", colour: "#44ff88" },
  { key: "moderate",   label: "SSP2-4.5 — Current policies", colour: "#ffd700" },
  { key: "worst",      label: "SSP5-8.5 — No action",        colour: "#ff4444" },
];

const THUMB_SIZE = 14;
const TRACK_H    = 4;

export default function Timeline({ year, scenario, onYearChange, onScenarioChange }: Props) {
  const pct      = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const isFuture = year > 2024;
  const todayPct = ((2024 - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

  const trackRef  = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);

  const yearFromX = useCallback((clientX: number) => {
    if (!trackRef.current) return year;
    const { left, width } = trackRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - left) / width));
    return Math.round(YEAR_MIN + t * (YEAR_MAX - YEAR_MIN));
  }, [year]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    onYearChange(yearFromX(e.clientX));
    const move = (e: MouseEvent) => { if (dragging.current) onYearChange(yearFromX(e.clientX)); };
    const up   = () => { dragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    onYearChange(yearFromX(e.touches[0].clientX));
    const move = (e: TouchEvent) => { if (dragging.current) onYearChange(yearFromX(e.touches[0].clientX)); };
    const end  = () => { dragging.current = false; window.removeEventListener("touchmove", move); window.removeEventListener("touchend", end); };
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
  };

  return (
    <div style={{
      position: "absolute",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(680px, 90vw)",
      fontFamily: "'Space Mono', monospace",
      zIndex: 20,
    }}>
      {/* Scenario picker */}
      {isFuture && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px" }}>
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => onScenarioChange(s.key)}
              style={{
                padding: "5px 10px", fontSize: "9px",
                letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: "4px", cursor: "pointer",
                border: `1px solid ${s.colour}`,
                background: scenario === s.key ? `${s.colour}22` : "rgba(0,0,0,0.5)",
                color: scenario === s.key ? s.colour : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}
            >{s.label}</button>
          ))}
        </div>
      )}

      {/* Year display */}
      <div style={{ textAlign: "center", marginBottom: "4px", display: "flex", alignItems: "baseline", justifyContent: "center", gap: "8px" }}>
        <span style={{
          fontSize: "clamp(28px, 5vw, 42px)", fontWeight: "bold",
          color: isFuture ? (scenario === "optimistic" ? "#44ff88" : scenario === "moderate" ? "#ffd700" : "#ff4444") : "#ffffff",
          letterSpacing: "0.05em",
        }}>{Math.round(year)}</span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
          {isFuture ? "PROJECTION" : "HISTORICAL DATA"}
        </span>
      </div>

      {/* Custom slider */}
      <div style={{ position: "relative", marginBottom: "6px" }}>

        {/* TODAY label */}
        <div style={{
          position: "absolute", left: `${todayPct}%`, top: "-14px",
          transform: "translateX(-50%)", fontSize: "8px",
          color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>TODAY</div>

        {/* Hit zone — full height, captures mouse/touch */}
        <div
          ref={trackRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{ position: "relative", height: "28px", cursor: "pointer", userSelect: "none" }}
        >
          {/* Track line — perfectly centred in hit zone */}
          <div style={{
            position: "absolute",
            top: "50%", transform: "translateY(-50%)",
            left: 0, right: 0,
            height: `${TRACK_H}px`, borderRadius: "2px",
            background: `linear-gradient(to right,
              rgba(255,255,255,0.6) 0%,
              rgba(255,255,255,0.6) ${todayPct}%,
              rgba(255,100,50,0.4) ${todayPct}%,
              rgba(255,100,50,0.4) ${pct}%,
              rgba(255,255,255,0.1) ${pct}%,
              rgba(255,255,255,0.1) 100%)`,
            pointerEvents: "none",
          }} />

          {/* TODAY vertical tick */}
          <div style={{
            position: "absolute", left: `${todayPct}%`,
            top: "50%", transform: "translate(-50%, -50%)",
            width: "1px", height: "12px",
            background: "rgba(255,255,255,0.3)",
            pointerEvents: "none",
          }} />

          {/* Thumb — same top/transform as track line = always centred */}
          <div style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: `${THUMB_SIZE}px`,
            height: `${THUMB_SIZE}px`,
            borderRadius: "50%",
            background: "#ffffff",
            border: "2px solid rgba(255,255,255,0.7)",
            boxShadow: "0 0 8px rgba(255,255,255,0.4)",
            pointerEvents: "none",
          }} />
        </div>
      </div>

      {/* Year labels — positioned to match the linear slider scale */}
      <div style={{
        position: "relative",
        height: "14px",
        fontSize: "9px",
        color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.1em",
        marginTop: "4px",
      }}>
        {[1850, 1900, 1950, 2000, 2024, 2050, 2100].map((y, i, arr) => {
          const pos = ((y - 1850) / (2100 - 1850)) * 100;
          const isFirst = i === 0;
          const isLast = i === arr.length - 1;
          return (
            <span
              key={y}
              onClick={() => onYearChange(y)}
              style={{
                position: "absolute",
                left: `${pos}%`,
                transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                cursor: "pointer",
                color: y === 2024 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
              }}
            >
              {y}
            </span>
          );
        })}
      </div>
    </div>
  );
}
