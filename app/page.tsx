"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { ClimateState } from "@/components/earth/EarthScene";
import ControlPanel from "@/components/earth/ControlPanel";
import Timeline from "@/components/earth/Timeline";
import EventCard from "@/components/earth/EventCard";
import PlayControls from "@/components/earth/PlayControls";
import { getClimateForYear, Scenario, YEAR_MIN, YEAR_MAX } from "@/lib/climateData";
import { getEventsForYear, ClimateEvent } from "@/lib/events";

const EarthScene = dynamic(() => import("@/components/earth/EarthScene"), { ssr: false });

export default function Home() {
  const [year, setYear]             = useState(1850);
  const [scenario, setScenario]     = useState<Scenario>("moderate");
  const [playing, setPlaying]       = useState(false);
  const [speed, setSpeed]           = useState(5);
  const [activeEvent, setActiveEvent] = useState<ClimateEvent | null>(null);

  // Fractional year ref for smooth animation
  const fracYear    = useRef(1850);
  const lastTime    = useRef<number | null>(null);
  const pauseUntil  = useRef(0);
  const animFrame   = useRef<number>(0);
  const pendingEvents = useRef<ClimateEvent[]>([]);

  const data    = getClimateForYear(year, scenario);
  const climate: ClimateState = {
    temperature:   data.temperature,
    co2:           data.co2,
    iceMelt:       data.iceMelt,
    deforestation: data.deforestation,
    seaLevel:      data.seaLevel,
  };

  // ── Animation loop ────────────────────────────────────────────────────────
  const tick = useCallback((now: number) => {
    if (!lastTime.current) lastTime.current = now;
    const dt = (now - lastTime.current) / 1000;
    lastTime.current = now;

    if (now >= pauseUntil.current) {
      // Advance year
      fracYear.current = Math.min(fracYear.current + dt * speed, YEAR_MAX);
      const rounded = Math.round(fracYear.current);
      setYear(rounded);

      // Check for events at new year
      const evts = getEventsForYear(fracYear.current);
      if (evts.length > 0 && !pendingEvents.current.some(e => e.year === evts[0].year)) {
        pendingEvents.current = evts;
        const evt = evts[0];
        setActiveEvent(evt);
        pauseUntil.current = now + evt.pauseMs;
        setTimeout(() => setActiveEvent(null), evt.pauseMs - 400);
      }

      // Reached end
      if (fracYear.current >= YEAR_MAX) {
        setPlaying(false);
        return;
      }
    }

    animFrame.current = requestAnimationFrame(tick);
  }, [speed]);

  useEffect(() => {
    if (playing) {
      lastTime.current = null;
      pendingEvents.current = [];
      animFrame.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animFrame.current);
      lastTime.current = null;
    }
    return () => cancelAnimationFrame(animFrame.current);
  }, [playing, tick]);

  const handleYearChange = (y: number) => {
    fracYear.current = y;
    setYear(y);
    setPlaying(false);
    setActiveEvent(null);
  };

  const togglePlay = () => {
    if (year >= YEAR_MAX) { fracYear.current = YEAR_MIN; setYear(YEAR_MIN); }
    setPlaying(p => !p);
    setActiveEvent(null);
  };

  // ── Headline ──────────────────────────────────────────────────────────────
  const t = data.tempC;
  const headline =
    year <= 1900 ? "hi, it's earth. i'm doing okay."                    :
    year <= 1950 ? "hi, it's earth. things are starting to change."     :
    year <= 1980 ? "hi, it's earth. i'm warming up. not in a good way." :
    year <= 2000 ? "hi, it's earth. can someone turn down the heat?"    :
    year <= 2010 ? "hi, it's earth. i need your attention."             :
    year <= 2024 ? "hi, it's earth. please stop."                       :
    t < 2.0      ? "hi, it's earth. there's still hope."                :
    t < 3.0      ? "hi, it's earth. we're running out of time."         :
    t < 4.0      ? "hi, it's earth. i'm begging you."                   :
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

      {/* Live stats strip */}
      <div style={{
        position: "absolute", top: "32px", right: "310px",
        display: "flex", gap: "18px", zIndex: 10,
        fontFamily: "'Space Mono', monospace",
      }}>
        {[
          { label: "TEMP",  value: `+${data.tempC.toFixed(2)}°C`,       colour: "#ff6644" },
          { label: "CO₂",   value: `${Math.round(data.co2Ppm)} ppm`,    colour: "#ff8c00" },
          { label: "SEA +", value: `+${Math.round(data.seaLevelMm)}mm`, colour: "#4488ff" },
          { label: "ICE",   value: `${data.iceExtent.toFixed(1)}M km²`, colour: "#00ccff" },
        ].map(({ label, value, colour }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em", marginBottom: "3px" }}>{label}</div>
            <div style={{ fontSize: "13px", color: colour, fontWeight: "bold", transition: "color 0.5s" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Event card */}
      <EventCard event={activeEvent} />

      {/* Play controls */}
      <PlayControls
        playing={playing}
        speed={speed}
        onToggle={togglePlay}
        onSpeedChange={s => { setSpeed(s); }}
      />

      {/* Timeline */}
      <Timeline
        year={year}
        scenario={scenario}
        onYearChange={handleYearChange}
        onScenarioChange={setScenario}
      />

      {/* Control panel */}
      <ControlPanel climate={climate} data={data} />
    </main>
  );
}
