"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { ClimateState } from "@/components/earth/EarthScene";
import type { CountryHit } from "@/components/earth/EarthScene";
import BottomBar from "@/components/earth/BottomBar";
import EventCard from "@/components/earth/EventCard";
import CountryPanel from "@/components/earth/CountryPanel";
import type { SelectedCountry } from "@/components/earth/CountryPanel";
import { getClimateForYear, Scenario, YEAR_MIN, YEAR_MAX } from "@/lib/climateData";
import { getEventsForYear, ClimateEvent } from "@/lib/events";

const EarthScene = dynamic(() => import("@/components/earth/EarthScene"), { ssr: false });

export default function Home() {
  const [year, setYear]               = useState(1850);
  const [scenario, setScenario]       = useState<Scenario>("moderate");
  const [playing, setPlaying]         = useState(false);
  const [speed, setSpeed]             = useState(5);
  const [activeEvent, setActiveEvent] = useState<ClimateEvent | null>(null);
  const [isMobile, setIsMobile]       = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);

  const handleCountryClick = useCallback((country: CountryHit) => {
    setSelectedCountry({ name: country.name, lat: country.lat, lon: country.lon });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fracYear       = useRef(1850);
  const lastTime       = useRef<number | null>(null);
  const pauseUntil     = useRef(0);
  const animFrame      = useRef<number>(0);
  const pendingEvents  = useRef<ClimateEvent[]>([]);

  const data    = getClimateForYear(year, scenario);
  const climate: ClimateState = {
    temperature:   data.temperature,
    co2:           data.co2,
    iceMelt:       data.iceMelt,
    deforestation: data.deforestation,
    seaLevel:      data.seaLevel,
    tempAnomaly:   data.tempC,
  };

  const tick = useCallback((now: number) => {
    if (!lastTime.current) lastTime.current = now;
    const dt = (now - lastTime.current) / 1000;
    lastTime.current = now;

    if (now >= pauseUntil.current) {
      fracYear.current = Math.min(fracYear.current + dt * speed, YEAR_MAX);
      const rounded = Math.round(fracYear.current);
      setYear(rounded);

      const evts = getEventsForYear(fracYear.current);
      if (evts.length > 0 && !pendingEvents.current.some(e => e.year === evts[0].year)) {
        pendingEvents.current = evts;
        const evt = evts[0];
        setActiveEvent(evt);
        pauseUntil.current = now + evt.pauseMs;
        setTimeout(() => setActiveEvent(null), evt.pauseMs - 400);
      }

      if (fracYear.current >= YEAR_MAX) { setPlaying(false); return; }
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

  const stats = [
    { label: "TEMP",  value: `${data.tempC > 0 ? "+" : ""}${data.tempC.toFixed(2)}°C`,     colour: "#ff6644" },
    { label: "CO₂",   value: `${Math.round(data.co2Ppm)} ppm`,                            colour: "#ff8c00" },
    { label: "SEA",   value: `${data.seaLevelMm >= 0 ? "+" : ""}${Math.round(data.seaLevelMm)}mm`, colour: "#4488ff" },
    { label: "ICE",   value: `${data.iceExtent.toFixed(1)}M km²`,                         colour: "#00ccff" },
  ];

  return (
    <main style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <EarthScene climate={climate} year={year} isMobile={isMobile} onCountryClick={handleCountryClick} />
      </div>

      {/* Mobile: stacked header — stats then headline */}
      {/* Desktop: headline left, stats top-right */}
      {isMobile ? (
        <div style={{
          position: "absolute", top: "16px", left: "16px", right: "16px",
          zIndex: 10, fontFamily: "'Space Mono', monospace",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          {/* Stats row */}
          <div style={{
            display: "flex", gap: "10px",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
            padding: "8px 14px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            {stats.map(({ label, value, colour }) => (
              <div key={label} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: "3px" }}>{label}</div>
                <div style={{ fontSize: "11px", color: colour, fontWeight: "bold" }}>{value}</div>
              </div>
            ))}
          </div>
          {/* Headline */}
          <p style={{
            fontSize: "11px", color: "rgba(255,255,255,0.8)",
            letterSpacing: "0.03em", lineHeight: 1.5,
            transition: "all 0.8s ease",
          }}>{headline}</p>
        </div>
      ) : (
        <>
          <div style={{
            position: "absolute", top: "28px", left: "32px",
            zIndex: 10, fontFamily: "'Space Mono', monospace", maxWidth: "50vw",
          }}>
            <h1 style={{
              fontSize: "clamp(13px, 1.8vw, 19px)",
              color: "rgba(255,255,255,0.88)",
              fontWeight: 400, letterSpacing: "0.03em", lineHeight: 1.5,
              transition: "all 0.8s ease",
            }}>{headline}</h1>
            <p style={{
              marginTop: "5px", fontSize: "8px",
              color: "rgba(255,255,255,0.22)",
              letterSpacing: "0.18em", textTransform: "uppercase",
            }}>nasa · noaa · nsidc · ipcc ar6</p>
          </div>
          <div style={{
            position: "absolute", top: "28px", right: "24px",
            display: "flex", gap: "18px", zIndex: 10,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
            padding: "10px 16px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.07)",
            fontFamily: "'Space Mono', monospace",
          }}>
            {stats.map(({ label, value, colour }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: "3px" }}>{label}</div>
                <div style={{ fontSize: "13px", color: colour, fontWeight: "bold", transition: "color 0.5s" }}>{value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Event card */}
      <EventCard event={activeEvent} />

      {/* Country detail panel */}
      {selectedCountry && (
        <CountryPanel
          country={selectedCountry}
          currentYear={year}
          scenario={scenario}
          onClose={() => setSelectedCountry(null)}
        />
      )}

      {/* Unified bottom bar */}
      <BottomBar
        year={year}
        scenario={scenario}
        playing={playing}
        speed={speed}
        onYearChange={handleYearChange}
        onScenarioChange={setScenario}
        onTogglePlay={togglePlay}
        onSpeedChange={setSpeed}
      />
    </main>
  );
}
