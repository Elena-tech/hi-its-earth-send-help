/**
 * CountryPanel — Side panel that slides in when a country is clicked.
 * Features an animated country stencil whose fill colour changes with
 * temperature anomaly as it plays through years, plus playback controls,
 * key stats, temperature chart, and warming stripes.
 */

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import TempTimeline from "./TempTimeline";
import TempChart from "./TempChart";
import { fetchCountryClimate } from "@/lib/api/openMeteo";
import { getCountryFeature, type CountryFeature } from "@/lib/geo/countries";
import type { CountryClimateData, YearlyTemp } from "@/lib/api/openMeteo";

export interface SelectedCountry {
  name: string;
  lat: number;
  lon: number;
}

type Scenario = "optimistic" | "moderate" | "worst";

interface Props {
  country: SelectedCountry;
  currentYear: number;
  scenario: Scenario;
  onClose: () => void;
}

/* ── Anomaly → colour helpers ───────────────────────────────────────── */
function anomalyColor(anomaly: number): string {
  if (anomaly <= -1.5) return "#08306b";
  if (anomaly <= -1)   return "#2166ac";
  if (anomaly <= -0.5) return "#67a9cf";
  if (anomaly <= 0)    return "#d1e5f0";
  if (anomaly <= 0.5)  return "#fddbc7";
  if (anomaly <= 1)    return "#ef8a62";
  if (anomaly <= 1.5)  return "#d6604d";
  if (anomaly <= 2)    return "#b2182b";
  if (anomaly <= 3)    return "#a01020";
  return "#67001f";
}

function anomalyBg(anomaly: number): string {
  if (anomaly <= -0.5) return "rgba(68,136,255,0.18)";
  if (anomaly <= 0)    return "rgba(68,136,255,0.08)";
  if (anomaly <= 0.5)  return "rgba(255,215,0,0.12)";
  if (anomaly <= 1)    return "rgba(255,140,0,0.15)";
  if (anomaly <= 1.5)  return "rgba(255,102,68,0.18)";
  if (anomaly <= 2)    return "rgba(255,68,68,0.2)";
  return "rgba(255,40,40,0.25)";
}

function anomalyTextColor(anomaly: number): string {
  if (anomaly <= 0)   return "#4488ff";
  if (anomaly <= 0.5) return "#ffd700";
  if (anomaly <= 1)   return "#ff8c00";
  if (anomaly <= 1.5) return "#ff6644";
  return "#ff4444";
}

const SPEEDS = [1, 5, 10, 25];

/* ━━━ Main component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function CountryPanel({ country, currentYear, scenario, onClose }: Props) {
  const [data, setData] = useState<CountryClimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryGeo, setCountryGeo] = useState<CountryFeature | null>(null);

  /* Local playback state for the animated stencil */
  const [localYear, setLocalYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const fracRef = useRef(0);
  const rafRef = useRef(0);
  const lastTRef = useRef(0);

  /* ── Fetch climate data ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetchCountryClimate(country.name, country.lat, country.lon)
      .then(result => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(err  => { if (!cancelled) { setError(err.message || "Failed to load data"); setLoading(false); } });

    return () => { cancelled = true; };
  }, [country.name, country.lat, country.lon]);

  /* ── Load country polygon ── */
  useEffect(() => {
    let cancelled = false;
    getCountryFeature(country.name).then(f => { if (!cancelled) setCountryGeo(f); });
    return () => { cancelled = true; };
  }, [country.name]);

  /* ── Derive year range ── */
  const yearRange = useMemo(() => {
    if (!data) return { min: 1940, max: 2024 };
    const all = [
      ...data.yearly.map(y => y.year),
      ...(data.projections[scenario] || []).map(y => y.year),
    ];
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [data, scenario]);

  /* Initialise localYear when data arrives */
  useEffect(() => {
    if (data && localYear === null) {
      setLocalYear(yearRange.min);
      fracRef.current = yearRange.min;
    }
  }, [data, localYear, yearRange.min]);

  /* ── Animation loop ── */
  useEffect(() => {
    if (!playing || !data) return;

    const tick = (ts: number) => {
      if (lastTRef.current === 0) lastTRef.current = ts;
      const dt = (ts - lastTRef.current) / 1000;
      lastTRef.current = ts;

      fracRef.current += dt * speed;
      if (fracRef.current >= yearRange.max) {
        fracRef.current = yearRange.max;
        setLocalYear(yearRange.max);
        setPlaying(false);
        lastTRef.current = 0;
        return;
      }
      setLocalYear(Math.round(fracRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); lastTRef.current = 0; };
  }, [playing, speed, data, yearRange.max]);

  /* ── Merged yearly + projection lookup ── */
  const allData = useMemo(() => {
    if (!data) return new Map<number, YearlyTemp>();
    const m = new Map<number, YearlyTemp>();
    for (const y of data.yearly) m.set(y.year, y);
    for (const y of (data.projections[scenario] || [])) { if (!m.has(y.year)) m.set(y.year, y); }
    return m;
  }, [data, scenario]);

  /* ── Stencil values ── */
  const stencilYear = localYear ?? yearRange.min;
  const stencilEntry = allData.get(stencilYear);
  const stencilAnomaly = stencilEntry && data ? stencilEntry.meanC - data.baseline : 0;

  /* ── Temperature rise (latest historical year vs baseline) ── */
  const latestTemp = data?.yearly[data.yearly.length - 1];
  const tempRise = latestTemp && data ? latestTemp.meanC - data.baseline : null;

  const projectionData: YearlyTemp[] = data?.projections[scenario] || [];

  /* ── Handlers ── */
  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const yr = Number(e.target.value);
    setLocalYear(yr);
    fracRef.current = yr;
  }, []);

  const togglePlay = useCallback(() => {
    if (!playing && localYear !== null && localYear >= yearRange.max) {
      setLocalYear(yearRange.min);
      fracRef.current = yearRange.min;
    }
    setPlaying(p => !p);
  }, [playing, localYear, yearRange]);

  /* ━━━ Render ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, width: 380, maxWidth: "92vw", height: "100vh",
      background: "rgba(0,0,0,0.90)", backdropFilter: "blur(24px)",
      borderLeft: "1px solid rgba(255,255,255,0.1)", zIndex: 100,
      display: "flex", flexDirection: "column", padding: "20px 18px", gap: 14,
      color: "white", animation: "slideInRight 0.35s ease", overflowY: "auto",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "white", fontFamily: "'Space Mono', monospace", letterSpacing: "-0.5px" }}>
            {country.name}
          </h2>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
            {Math.abs(country.lat).toFixed(1)}°{country.lat >= 0 ? "N" : "S"},{" "}
            {Math.abs(country.lon).toFixed(1)}°{country.lon >= 0 ? "E" : "W"}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close panel" style={{
          background: "rgba(255,255,255,0.1)", border: "none", color: "white",
          width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 15,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>✕</button>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🌡️</div>
          <div style={{ fontSize: 12 }}>Fetching temperature data...</div>
          <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>Open-Meteo ERA5 Reanalysis</div>
        </div>
      )}
      {error && (
        <div style={{ padding: 14, background: "rgba(255,68,68,0.15)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#ff6644" }}>
          {error}
        </div>
      )}

      {/* ── Data ── */}
      {data && !loading && (
        <>
          {/* ▸ Animated Country Stencil */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "14px 14px 10px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {countryGeo && <AnimatedStencil feature={countryGeo} size={150} anomaly={stencilAnomaly} />}

              {/* Year display */}
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: "white", marginTop: 6 }}>
                {stencilYear}
              </div>
              <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: anomalyTextColor(stencilAnomaly), marginTop: 2 }}>
                {stencilAnomaly >= 0 ? "+" : ""}{stencilAnomaly.toFixed(2)}°C
                <span style={{ opacity: 0.5, color: "rgba(255,255,255,0.5)", marginLeft: 6 }}>vs baseline</span>
              </div>
            </div>

            {/* Playback controls */}
            <div style={{ marginTop: 12 }}>
              {/* Slider */}
              <input type="range" min={yearRange.min} max={yearRange.max} step={1} value={stencilYear} onChange={handleSlider}
                style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.3)", borderRadius: 2, outline: "none", cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 8, opacity: 0.4, fontFamily: "'Space Mono', monospace" }}>{yearRange.min}</span>
                <span style={{ fontSize: 8, opacity: 0.4, fontFamily: "'Space Mono', monospace" }}>{yearRange.max}</span>
              </div>

              {/* Play + Speed + Temp */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <button onClick={togglePlay} style={{
                  width: 32, height: 32, borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: playing ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                  color: "white", fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{playing ? "⏸" : "▶"}</button>

                <div style={{ marginLeft: "auto", fontSize: 10, fontFamily: "'Space Mono', monospace", opacity: 0.6 }}>
                  {stencilEntry ? `${stencilEntry.meanC.toFixed(1)}°C` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* ▸ Key Stats (3 cards) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <StatCard
              label="Temperature Rise"
              value={tempRise !== null ? `${tempRise >= 0 ? "+" : ""}${tempRise.toFixed(1)}°C` : "—"}
              sublabel={latestTemp ? `${latestTemp.year} vs baseline` : ""}
              bgColor={tempRise !== null ? anomalyBg(tempRise) : undefined}
              valueColor={tempRise !== null ? anomalyTextColor(tempRise) : undefined}
            />
            <StatCard label="Baseline" value={`${data.baseline.toFixed(1)}°C`} sublabel="1951–1980 avg" />
            <StatCard label="Data Range" value={`${data.yearly.length} yrs`} sublabel={`${data.yearly[0]?.year}–${data.yearly[data.yearly.length - 1]?.year}`} />
          </div>

          {/* ▸ Temperature Timeseries */}
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
              TEMPERATURE TIMESERIES
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 4px 4px" }}>
              <TempChart yearly={data.yearly} projections={data.projections} baseline={data.baseline} currentYear={currentYear} scenario={scenario} />
            </div>
          </div>

          {/* ▸ Warming Stripes */}
          <div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
              WARMING STRIPES — <span style={{ textTransform: "none", opacity: 0.7, fontSize: 9 }}>temp anomaly by year</span>
            </div>
            <TempTimeline yearly={data.yearly} baseline={data.baseline} currentYear={currentYear} projections={projectionData} label="Historical + Projected" />
          </div>

          {/* ▸ Attribution */}
          <div style={{ fontSize: 9, opacity: 0.4, marginTop: 8, lineHeight: 1.6, color: "rgba(255,255,255,0.4)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
            Data: Open-Meteo ERA5 Reanalysis (Copernicus/ECMWF)<br />
            Projections: CMIP6 climate models<br />
            Baseline: 1951–1980 climatological mean
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ━━━ Sub-components ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function StatCard({ label, value, sublabel, bgColor, valueColor }: {
  label: string; value: string; sublabel?: string; bgColor?: string; valueColor?: string;
}) {
  return (
    <div style={{
      background: bgColor || "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10,
    }}>
      <div style={{ fontSize: 8, opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3, color: "rgba(255,255,255,0.7)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: valueColor || "white" }}>{value}</div>
      {sublabel && <div style={{ fontSize: 8, opacity: 0.6, marginTop: 2, color: "rgba(255,255,255,0.6)" }}>{sublabel}</div>}
    </div>
  );
}

/** Large SVG country stencil whose fill transitions with temperature anomaly. */
function AnimatedStencil({ feature, size, anomaly }: { feature: CountryFeature; size: number; anomaly: number }) {
  const allCoords: [number, number][] = [];
  for (const ring of feature.polygons)
    for (const [lon, lat] of ring) allCoords.push([lon, lat]);

  if (allCoords.length === 0) return null;

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of allCoords) {
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }

  const dLon = maxLon - minLon || 1;
  const dLat = maxLat - minLat || 1;
  const pad = 0.06;
  const aspect = dLon / dLat;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;

  const projX = (lon: number) => ((lon - minLon) / dLon) * w * (1 - 2 * pad) + w * pad;
  const projY = (lat: number) => h - ((lat - minLat) / dLat) * h * (1 - 2 * pad) - h * pad;

  const paths = feature.polygons.map(ring =>
    ring.map(([lon, lat], i) => `${i === 0 ? "M" : "L"}${projX(lon).toFixed(1)},${projY(lat).toFixed(1)}`).join(" ") + " Z"
  );

  const fill = anomalyColor(anomaly);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill={fill} fillOpacity={0.5} stroke={fill} strokeWidth={1} strokeOpacity={0.85}
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }} />
      ))}
    </svg>
  );
}
