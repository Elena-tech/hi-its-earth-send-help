"use client";

import { Scenario } from "@/lib/climateData";

interface Props {
  year: number;
  scenario: Scenario;
  playing: boolean;
  speed: number;
  onYearChange: (y: number) => void;
  onScenarioChange: (s: Scenario) => void;
  onTogglePlay: () => void;
  onSpeedChange: (s: number) => void;
}

const SCENARIOS: { key: Scenario; label: string; colour: string }[] = [
  { key: "optimistic", label: "SSP1-2.6",  colour: "#44ff88" },
  { key: "moderate",   label: "SSP2-4.5",  colour: "#ffd700" },
  { key: "worst",      label: "SSP5-8.5",  colour: "#ff4444" },
];

const SPEEDS = [1, 5, 10, 25];
const YEAR_MIN = 1850;
const YEAR_MAX = 2100;
const todayPct = ((2024 - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

export default function BottomBar({
  year, scenario, playing, speed,
  onYearChange, onScenarioChange, onTogglePlay, onSpeedChange,
}: Props) {
  const isFuture = year > 2024;
  const pct = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const scenColour = SCENARIOS.find(s => s.key === scenario)?.colour ?? "#ffd700";

  return (
    <div style={{
      position: "absolute",
      bottom: 0,
      left: 0, right: 0,
      padding: "0 20px",
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
      background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
      zIndex: 30,
      fontFamily: "'Space Mono', monospace",
    }}>

      {/* Row 1: play + speed + year + scenario */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "10px",
        flexWrap: "wrap",
      }}>
        {/* Play/Pause */}
        <button onClick={onTogglePlay} style={{
          width: "40px", height: "40px", borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.35)",
          background: playing ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
          color: "rgba(255,255,255,0.9)", fontSize: "15px",
          cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {playing ? "⏸" : "▶"}
        </button>

        {/* Speed buttons */}
        {SPEEDS.map(s => (
          <button key={s} onClick={() => onSpeedChange(s)} style={{
            padding: "5px 10px", fontSize: "9px", letterSpacing: "0.06em",
            borderRadius: "5px", cursor: "pointer",
            border: `1px solid ${speed === s ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)"}`,
            background: speed === s ? "rgba(255,255,255,0.12)" : "transparent",
            color: speed === s ? "#fff" : "rgba(255,255,255,0.3)",
          }}>{s}×</button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Year + label */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{
            fontSize: "clamp(24px, 5vw, 36px)", fontWeight: "bold",
            color: isFuture ? scenColour : "#fff",
            transition: "color 0.3s",
          }}>
            {Math.round(year)}
          </span>
          <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>
            {isFuture ? "PROJECTION" : "HISTORICAL"}
          </span>
        </div>

        {/* Scenario buttons — only when in future */}
        {isFuture && SCENARIOS.map(s => (
          <button key={s.key} onClick={() => onScenarioChange(s.key)} style={{
            padding: "5px 9px", fontSize: "8px", letterSpacing: "0.08em",
            borderRadius: "4px", cursor: "pointer",
            border: `1px solid ${s.colour}`,
            background: scenario === s.key ? `${s.colour}22` : "transparent",
            color: scenario === s.key ? s.colour : "rgba(255,255,255,0.35)",
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Row 2: slider */}
      <div style={{ position: "relative", marginBottom: "6px" }}>
        {/* TODAY marker */}
        <div style={{
          position: "absolute", left: `${todayPct}%`,
          top: "-14px", transform: "translateX(-50%)",
          fontSize: "7px", color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.12em", pointerEvents: "none",
        }}>TODAY</div>
        <div style={{
          position: "absolute", left: `${todayPct}%`,
          top: 0, bottom: 0, width: "1px",
          background: "rgba(255,255,255,0.2)", pointerEvents: "none", zIndex: 1,
        }} />
        <input type="range" min={YEAR_MIN} max={YEAR_MAX} step={1} value={year}
          onChange={e => onYearChange(Number(e.target.value))}
          style={{
            width: "100%", appearance: "none", height: "4px", borderRadius: "2px",
            background: `linear-gradient(to right,
              rgba(255,255,255,0.6) 0%,
              rgba(255,255,255,0.6) ${todayPct}%,
              rgba(200,80,40,0.5) ${todayPct}%,
              rgba(200,80,40,0.5) ${pct}%,
              rgba(255,255,255,0.1) ${pct}%,
              rgba(255,255,255,0.1) 100%)`,
            outline: "none", cursor: "pointer", position: "relative", zIndex: 2,
          }}
        />
      </div>

      {/* Row 3: year labels — positioned to match the linear slider scale */}
      <div style={{
        position: "relative",
        height: "14px",
        fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em",
      }}>
        {[1850, 1900, 1950, 2000, 2024, 2050, 2100].map((y, i, arr) => {
          const pos = ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
          const isFirst = i === 0;
          const isLast = i === arr.length - 1;
          return (
            <span key={y} onClick={() => onYearChange(y)} style={{
              position: "absolute",
              left: `${pos}%`,
              transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
              cursor: "pointer",
              color: y === 2024 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.28)",
            }}>{y}</span>
          );
        })}
      </div>
    </div>
  );
}
