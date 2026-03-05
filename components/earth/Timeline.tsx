"use client";

import { Scenario } from "@/lib/climateData";

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

export default function Timeline({ year, scenario, onYearChange, onScenarioChange }: Props) {
  const pct = ((year - 1850) / (2100 - 1850)) * 100;
  const isFuture = year > 2024;
  const todayPct = ((2024 - 1850) / (2100 - 1850)) * 100;

  return (
    <div style={{
      position: "absolute",
      bottom: "32px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(680px, 90vw)",
      fontFamily: "'Space Mono', monospace",
      zIndex: 20,
    }}>
      {/* Scenario picker — only show for future */}
      {isFuture && (
        <div style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          marginBottom: "12px",
        }}>
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              onClick={() => onScenarioChange(s.key)}
              style={{
                padding: "5px 10px",
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                borderRadius: "4px",
                cursor: "pointer",
                border: `1px solid ${s.colour}`,
                background: scenario === s.key ? `${s.colour}22` : "rgba(0,0,0,0.5)",
                color: scenario === s.key ? s.colour : "rgba(255,255,255,0.4)",
                transition: "all 0.2s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Year display */}
      <div style={{
        textAlign: "center",
        marginBottom: "4px",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "center",
        gap: "8px",
      }}>
        <span style={{
          fontSize: "clamp(28px, 5vw, 42px)",
          fontWeight: "bold",
          color: isFuture ? (
            scenario === "optimistic" ? "#44ff88" :
            scenario === "moderate"   ? "#ffd700" : "#ff4444"
          ) : "#ffffff",
          letterSpacing: "0.05em",
        }}>
          {Math.round(year)}
        </span>
        {isFuture && (
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
            PROJECTION
          </span>
        )}
        {!isFuture && (
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
            HISTORICAL DATA
          </span>
        )}
      </div>

      {/* Slider track */}
      <div style={{ position: "relative", marginBottom: "6px" }}>
        {/* Today marker */}
        <div style={{
          position: "absolute",
          left: `${todayPct}%`,
          top: "-14px",
          transform: "translateX(-50%)",
          fontSize: "8px",
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.1em",
          whiteSpace: "nowrap",
        }}>TODAY</div>
        <div style={{
          position: "absolute",
          left: `${todayPct}%`,
          top: "0",
          bottom: "0",
          width: "1px",
          background: "rgba(255,255,255,0.25)",
          pointerEvents: "none",
          zIndex: 1,
        }} />

        <input
          type="range"
          min={1850}
          max={2100}
          step={1}
          value={year}
          onChange={e => onYearChange(Number(e.target.value))}
          style={{
            width: "100%",
            appearance: "none",
            height: "4px",
            borderRadius: "2px",
            background: `linear-gradient(to right,
              rgba(255,255,255,0.6) 0%,
              rgba(255,255,255,0.6) ${todayPct}%,
              rgba(255,100,50,0.4) ${todayPct}%,
              rgba(255,100,50,0.4) ${pct}%,
              rgba(255,255,255,0.1) ${pct}%,
              rgba(255,255,255,0.1) 100%)`,
            outline: "none",
            cursor: "pointer",
            position: "relative",
            zIndex: 2,
          }}
        />
      </div>

      {/* Year labels */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "9px",
        color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.1em",
        marginTop: "4px",
      }}>
        {[1850, 1900, 1950, 2000, 2024, 2050, 2100].map(y => (
          <span
            key={y}
            onClick={() => onYearChange(y)}
            style={{ cursor: "pointer", color: y === 2024 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}
          >
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}
