"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ClimateState } from "@/components/earth/EarthScene";
import ControlPanel from "@/components/earth/ControlPanel";

// Load Three.js scene client-side only
const EarthScene = dynamic(() => import("@/components/earth/EarthScene"), { ssr: false });

const INITIAL_CLIMATE: ClimateState = {
  temperature: 0.0,
  co2: 0.0,
  iceMelt: 0.0,
  deforestation: 0.0,
  seaLevel: 0.0,
};

export default function Home() {
  const [climate, setClimate] = useState<ClimateState>(INITIAL_CLIMATE);

  const handleChange = (key: keyof ClimateState, value: number) => {
    setClimate(prev => ({ ...prev, [key]: value }));
  };

  // Simple severity score for headline
  const severity = (climate.temperature + climate.co2 + climate.iceMelt + climate.deforestation + climate.seaLevel) / 5;
  const headline =
    severity === 0     ? "hi, it's earth. i'm okay right now."   :
    severity < 0.2     ? "hi, it's earth. things are changing."  :
    severity < 0.5     ? "hi, it's earth. i need your attention.":
    severity < 0.75    ? "hi, it's earth. please stop."           :
                         "hi, it's earth. send help.";

  return (
    <main style={{
      width: "100vw",
      height: "100vh",
      background: "#000",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Globe */}
      <div style={{ position: "absolute", inset: 0 }}>
        <EarthScene climate={climate} />
      </div>

      {/* Top title */}
      <div style={{
        position: "absolute",
        top: "32px",
        left: "40px",
        zIndex: 10,
        fontFamily: "'Space Mono', monospace",
      }}>
        <h1 style={{
          fontSize: "clamp(14px, 2.5vw, 22px)",
          color: "rgba(255,255,255,0.9)",
          fontWeight: 400,
          letterSpacing: "0.05em",
          lineHeight: 1.4,
          maxWidth: "60vw",
          transition: "all 0.6s ease",
        }}>
          {headline}
        </h1>
        <p style={{
          marginTop: "6px",
          fontSize: "10px",
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}>
          interactive climate simulation · drag to rotate
        </p>
      </div>

      {/* Severity indicator */}
      {severity > 0 && (
        <div style={{
          position: "absolute",
          bottom: "32px",
          left: "40px",
          zIndex: 10,
          fontFamily: "'Space Mono', monospace",
        }}>
          <p style={{
            fontSize: "9px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}>Crisis Level</p>
          <div style={{
            width: "200px",
            height: "3px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "2px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${severity * 100}%`,
              background: `hsl(${120 - severity * 120}, 100%, 50%)`,
              borderRadius: "2px",
              transition: "width 0.3s ease, background 0.3s ease",
            }} />
          </div>
          <p style={{
            marginTop: "6px",
            fontSize: "10px",
            color: `hsl(${120 - severity * 120}, 80%, 60%)`,
            fontWeight: "bold",
          }}>
            {Math.round(severity * 100)}%
          </p>
        </div>
      )}

      {/* Control Panel */}
      <ControlPanel climate={climate} onChange={handleChange} />
    </main>
  );
}
