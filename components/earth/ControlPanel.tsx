"use client";

import { ClimateState } from "./EarthScene";
import { ClimateValues } from "@/lib/climateData";

interface Props {
  climate: ClimateState;
  data: ClimateValues;
}

export default function ControlPanel({ climate, data }: Props) {
  const rows = [
    {
      label:  "Temperature",
      raw:    `+${data.tempC.toFixed(2)}°C`,
      sub:    "vs pre-industrial",
      fill:   climate.temperature,
      colour: "#ff4444",
      source: "NASA GISS",
    },
    {
      label:  "CO₂",
      raw:    `${Math.round(data.co2Ppm)} ppm`,
      sub:    "pre-ind: 280 ppm",
      fill:   climate.co2,
      colour: "#ff8c00",
      source: "NOAA / Mauna Loa",
    },
    {
      label:  "Arctic Ice",
      raw:    `${data.iceExtent.toFixed(1)}M km²`,
      sub:    "Sept minimum",
      fill:   climate.iceMelt,
      colour: "#00ccff",
      source: "NSIDC",
    },
    {
      label:  "Deforestation",
      raw:    `${data.deforPct.toFixed(1)}% lost`,
      sub:    "of 1850 cover",
      fill:   climate.deforestation,
      colour: "#44ff88",
      source: "Global Forest Watch",
    },
    {
      label:  "Sea Level",
      raw:    `+${Math.round(data.seaLevelMm)} mm`,
      sub:    "vs 1900",
      fill:   climate.seaLevel,
      colour: "#4488ff",
      source: "CSIRO / NASA",
    },
  ];

  return (
    <div style={{
      position: "absolute", right: "24px", top: "50%",
      transform: "translateY(-50%)",
      width: "270px",
      background: "rgba(0,0,0,0.78)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      padding: "20px 22px",
      backdropFilter: "blur(14px)",
      fontFamily: "'Space Mono', monospace",
      zIndex: 10,
    }}>
      <p style={{
        color: "rgba(255,255,255,0.35)",
        fontSize: "8px", letterSpacing: "0.2em",
        textTransform: "uppercase", marginBottom: "16px",
      }}>
        Real-Time Indicators
      </p>

      {rows.map(r => (
        <div key={r.label} style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px" }}>{r.label}</span>
            <span style={{ color: r.colour, fontSize: "12px", fontWeight: "bold" }}>{r.raw}</span>
          </div>
          {/* Progress bar — read only, driven by real data */}
          <div style={{
            height: "3px", borderRadius: "2px",
            background: "rgba(255,255,255,0.08)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.round(r.fill * 100)}%`,
              background: r.colour,
              borderRadius: "2px",
              transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: "3px",
          }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)" }}>{r.sub}</span>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.18)" }}>{r.source}</span>
          </div>
        </div>
      ))}

      <div style={{
        marginTop: "8px", paddingTop: "12px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        fontSize: "8px", color: "rgba(255,255,255,0.2)",
        lineHeight: 1.6,
      }}>
        Drag the timeline to travel through time.<br/>
        Past 2024: select an IPCC scenario.
      </div>
    </div>
  );
}
