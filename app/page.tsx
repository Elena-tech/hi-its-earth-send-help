"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ClimateState } from "@/components/earth/EarthScene";
import ControlPanel from "@/components/earth/ControlPanel";
import Timeline from "@/components/earth/Timeline";
import { getClimateForYear, Scenario, YEAR_MIN, YEAR_MAX } from "@/lib/climateData";

const EarthScene = dynamic(() => import("@/components/earth/EarthScene"), { ssr: false });

export default function Home() {
  const [year, setYear]         = useState(2024);
  const [scenario, setScenario] = useState<Scenario>("moderate");

  const data = getClimateForYear(year, scenario);

  const climate: ClimateState = {
    temperature:   data.temperature,
    co2:           data.co2,
    iceMelt:       data.iceMelt,
    deforestation: data.deforestation,
    seaLevel:      data.seaLevel,
  };

  // Dynamic headline
  const t = data.tempC;
  const headline =
    year <= 1900 ? "hi, it's earth. i'm doing okay."                 :
    year <= 1950 ? "hi, it's earth. things are starting to change."  :
    year <= 1980 ? "hi, it's earth. i'm warming up. not in a good way." :
    year <= 2000 ? "hi, it's earth. can someone turn down the heat?" :
    year <= 2010 ? "hi, it's earth. i need your attention."          :
    year <= 2024 ? "hi, it's earth. please stop."                    :
    t < 2.0      ? "hi, it's earth. there's still hope."             :
    t < 3.0      ? "hi, it's earth. we're running out of time."      :
    t < 4.0      ? "hi, it's earth. i'm begging you."                :
                   "hi, it's earth. send help.";

  return (
    <main style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>
      {/* Globe */}
      <div style={{ position: "absolute", inset: 0 }}>
        <EarthScene climate={climate} />
      </div>

      {/* Top title */}
      <div style={{
        position: "absolute", top: "32px", left: "40px", zIndex: 10,
        fontFamily: "'Space Mono', monospace",
      }}>
        <h1 style={{
          fontSize: "clamp(13px, 2vw, 20px)",
          color: "rgba(255,255,255,0.9)",
          fontWeight: 400,
          letterSpacing: "0.04em",
          lineHeight: 1.5,
          maxWidth: "55vw",
          transition: "all 0.8s ease",
        }}>
          {headline}
        </h1>
        <p style={{
          marginTop: "6px", fontSize: "9px",
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          real data · nasa / noaa / nsidc / ipcc ar6 · drag to rotate
        </p>
      </div>

      {/* Stats strip */}
      <div style={{
        position: "absolute", top: "32px", right: "320px",
        display: "flex", gap: "20px", zIndex: 10,
        fontFamily: "'Space Mono', monospace",
      }}>
        {[
          { label: "TEMP",     value: `+${data.tempC.toFixed(2)}°C`,         colour: "#ff6644" },
          { label: "CO₂",      value: `${Math.round(data.co2Ppm)} ppm`,      colour: "#ff8c00" },
          { label: "SEA +",    value: `${Math.round(data.seaLevelMm)} mm`,   colour: "#4488ff" },
          { label: "ICE",      value: `${data.iceExtent.toFixed(1)}M km²`,   colour: "#00ccff" },
          { label: "FOREST –", value: `${data.deforPct.toFixed(1)}%`,        colour: "#44ff88" },
        ].map(({ label, value, colour }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em", marginBottom: "3px" }}>
              {label}
            </div>
            <div style={{ fontSize: "13px", color: colour, fontWeight: "bold" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <Timeline
        year={year}
        scenario={scenario}
        onYearChange={setYear}
        onScenarioChange={setScenario}
      />

      {/* Control Panel */}
      <ControlPanel climate={climate} data={data} />
    </main>
  );
}
