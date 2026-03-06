/**
 * Global heatmap data
 * Fetches annual temperature anomaly for every country centroid via Open-Meteo ERA5.
 * Conservative rate limiting: 1 request per country, 600ms between requests.
 * Results cached 24h. Builds progressively — listeners called as each country resolves.
 */

import { cacheGet, cacheSet } from "./cache";
import { loadCountries } from "../geo/countries";

export type AnomalyMap = Map<string, number>; // countryName → °C anomaly vs 1951-1980

const ERA5_BASE = "https://archive-api.open-meteo.com/v1/era5";

// Countries to prioritise (load first so the map fills in meaningfully fast)
const PRIORITY = [
  "United States of America", "China", "Russia", "India", "Brazil",
  "Australia", "Canada", "Germany", "United Kingdom", "France",
  "Japan", "South Africa", "Nigeria", "Argentina", "Indonesia",
  "Mexico", "Italy", "Spain", "Saudi Arabia", "Egypt",
];

let latestMap: AnomalyMap = new Map();
let listeners: Array<(map: AnomalyMap) => void> = [];

export function onHeatmapUpdate(cb: (map: AnomalyMap) => void) {
  listeners.push(cb);
  if (latestMap.size > 0) cb(new Map(latestMap));
  return () => { listeners = listeners.filter(l => l !== cb); };
}

function notify() {
  const snapshot = new Map(latestMap);
  listeners.forEach(l => l(snapshot));
}

/** Single fetch with exponential backoff on 429 */
async function fetchWithRetry(url: string, maxRetries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      if (attempt === maxRetries) throw new Error("Rate limited after retries");
      const wait = Math.pow(2, attempt + 1) * 1500; // 3s, 6s, 12s, 24s
      console.warn(`Open-Meteo 429 — waiting ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("fetchWithRetry: unreachable");
}

/**
 * One ERA5 request covering 1951→target year.
 * Compute baseline (1951-1980) and target anomaly locally.
 */
async function fetchAnomalyForPoint(
  lat: number, lon: number, year: number
): Promise<number | null> {
  const targetYear = Math.min(year, 2024);
  const cacheKey = `anomaly2:${lat.toFixed(1)}:${lon.toFixed(1)}:${targetYear}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const url = `${ERA5_BASE}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}`
      + `&start_date=1951-01-01&end_date=${targetYear}-12-31`
      + `&daily=temperature_2m_mean&timezone=UTC`;

    const res = await fetchWithRetry(url);
    if (!res.ok) return null;

    const data = await res.json();
    const dates: string[]         = data.daily?.time               ?? [];
    const temps: (number | null)[] = data.daily?.temperature_2m_mean ?? [];

    if (dates.length === 0) return null;

    // Aggregate into annual means
    const yearlyMeans = new Map<number, number[]>();
    for (let i = 0; i < dates.length; i++) {
      const t = temps[i];
      if (t === null || t === undefined) continue;
      const y = parseInt(dates[i].slice(0, 4), 10);
      if (!yearlyMeans.has(y)) yearlyMeans.set(y, []);
      yearlyMeans.get(y)!.push(t);
    }

    // Baseline: mean of annual means 1951-1980
    const baselineYears: number[] = [];
    for (let y = 1951; y <= 1980; y++) {
      const vals = yearlyMeans.get(y);
      if (vals && vals.length > 0) baselineYears.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    if (baselineYears.length < 10) return null; // not enough baseline data
    const baseline = baselineYears.reduce((a, b) => a + b, 0) / baselineYears.length;

    // Target year mean
    const targetVals = yearlyMeans.get(targetYear);
    if (!targetVals || targetVals.length === 0) return null;
    const targetMean = targetVals.reduce((a, b) => a + b, 0) / targetVals.length;

    const anomaly = parseFloat((targetMean - baseline).toFixed(2));
    cacheSet(cacheKey, anomaly);
    return anomaly;
  } catch (e) {
    console.warn("ERA5 fetch failed:", e);
    return null;
  }
}

let currentFetch: { year: number; controller: AbortController } | null = null;

export async function loadGlobalHeatmap(year: number): Promise<void> {
  if (currentFetch && currentFetch.year !== year) {
    currentFetch.controller.abort();
    currentFetch = null;
  }
  if (currentFetch?.year === year) return;

  const controller = new AbortController();
  currentFetch = { year, controller };

  const countries = await loadCountries();

  // Sort so priority countries go first
  const sorted = [...countries].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.name);
    const bi = PRIORITY.indexOf(b.name);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  for (const country of sorted) {
    if (controller.signal.aborted) return;

    const [lon, lat] = country.centroid;
    const anomaly = await fetchAnomalyForPoint(lat, lon, year);

    if (anomaly !== null && !controller.signal.aborted) {
      latestMap.set(country.name, anomaly);
      notify();
    }

    // 600ms between requests — conservative but Open-Meteo allows ~100 req/min
    if (!controller.signal.aborted) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  currentFetch = null;
}
