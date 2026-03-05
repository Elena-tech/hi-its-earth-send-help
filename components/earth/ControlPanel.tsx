"use client";

import { ClimateState } from "./EarthScene";

interface Props {
  climate: ClimateState;
  onChange: (key: keyof ClimateState, value: number) => void;
}

const controls: {
  key: keyof ClimateState;
  label: string;
  unit: string;
  min: number;
  max: number;
  format: (v: number) => string;
  colour: string;
}[] = [
  {
    key: "temperature",
    label: "Temperature Rise",
    unit: "°C",
    min: 0, max: 1,
    format: v => `+${(v * 4).toFixed(1)}°C`,
    colour: "#ff4444",
  },
  {
    key: "co2",
    label: "CO₂ Concentration",
    unit: "ppm",
    min: 0, max: 1,
    format: v => `${Math.round(280 + v * 520)} ppm`,
    colour: "#ff8c00",
  },
  {
    key: "iceMelt",
    label: "Ice Cap Melt",
    unit: "%",
    min: 0, max: 1,
    format: v => `${Math.round(v * 100)}%`,
    colour: "#00ccff",
  },
  {
    key: "deforestation",
    label: "Deforestation",
    unit: "%",
    min: 0, max: 1,
    format: v => `${Math.round(v * 100)}%`,
    colour: "#44ff88",
  },
  {
    key: "seaLevel",
    label: "Sea Level Rise",
    unit: "m",
    min: 0, max: 1,
    format: v => `+${(v * 2).toFixed(1)}m`,
    colour: "#4488ff",
  },
];

export default function ControlPanel({ climate, onChange }: Props) {
  return (
    <div style={{
      position: "absolute",
      right: "24px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "280px",
      background: "rgba(0,0,0,0.75)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "24px",
      backdropFilter: "blur(12px)",
      fontFamily: "'Space Mono', monospace",
    }}>
      <p style={{
        color: "rgba(255,255,255,0.4)",
        fontSize: "9px",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        marginBottom: "20px",
      }}>
        Climate Parameters
      </p>

      {controls.map(ctrl => (
        <div key={ctrl.key} style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>
              {ctrl.label}
            </span>
            <span style={{ color: ctrl.colour, fontSize: "11px", fontWeight: "bold" }}>
              {ctrl.format(climate[ctrl.key])}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={climate[ctrl.key]}
            onChange={e => onChange(ctrl.key, parseFloat(e.target.value))}
            style={{
              width: "100%",
              appearance: "none",
              height: "3px",
              borderRadius: "2px",
              background: `linear-gradient(to right, ${ctrl.colour} 0%, ${ctrl.colour} ${climate[ctrl.key] * 100}%, rgba(255,255,255,0.15) ${climate[ctrl.key] * 100}%, rgba(255,255,255,0.15) 100%)`,
              outline: "none",
              cursor: "pointer",
            }}
          />
        </div>
      ))}

      <div style={{
        marginTop: "24px",
        paddingTop: "16px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        <button
          onClick={() => controls.forEach(c => onChange(c.key, 0))}
          style={{
            width: "100%",
            padding: "8px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            color: "rgba(255,255,255,0.5)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            cursor: "pointer",
            marginBottom: "8px",
          }}
        >
          Reset / Pre-Industrial
        </button>
        <button
          onClick={() => controls.forEach(c => onChange(c.key, 0.28))}
          style={{
            width: "100%",
            padding: "8px",
            background: "rgba(255,100,0,0.1)",
            border: "1px solid rgba(255,100,0,0.3)",
            borderRadius: "6px",
            color: "rgba(255,150,50,0.8)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            cursor: "pointer",
            marginBottom: "8px",
          }}
        >
          Today (2024)
        </button>
        <button
          onClick={() => controls.forEach(c => onChange(c.key, 1.0))}
          style={{
            width: "100%",
            padding: "8px",
            background: "rgba(255,0,0,0.1)",
            border: "1px solid rgba(255,0,0,0.3)",
            borderRadius: "6px",
            color: "rgba(255,80,80,0.9)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Worst Case 2100
        </button>
      </div>
    </div>
  );
}
