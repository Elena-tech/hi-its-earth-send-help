/**
 * Global heatmap data
 * Fetches annual temperature anomaly for every country centroid via Open-Meteo ERA5.
 * Results are cached 24h. Requests are staggered to avoid rate limits.
 * Returns a Map<countryName, anomalyC> for a given year.
 */

import { cacheGet, cacheSet } from "./cache";
import { loadCountries } from "../geo/countries";

export type AnomalyMap = Map<string, number>; // countryName → °C anomaly vs 1951-1980

const ERA5_BASE = "https://archive-api.open-meteo.com/v1/era5";

// In-memory store of the latest anomaly map
let latestMap: AnomalyMap = new Map();
let listeners: Array<(map: AnomalyMap) => void> = [];

export function onHeatmapUpdate(cb: (map: AnomalyMap) => void) {
  listeners.push(cb);
  // Immediately call with current data if we have any
  if (latestMap.size > 0) cb(new Map(latestMap));
  return () => { listeners = listeners.filter(l => l !== cb); };
}

function notify() {
  const snapshot = new Map(latestMap);
  listeners.forEach(l => l(snapshot));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      if (attempt === maxRetries) return res;
      const wait = Math.pow(2, attempt + 1) * 1000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("fetchWithRetry: unreachable");
}

/** Fetch annual mean temp for a centroid, compute anomaly vs 1951-1980 baseline */
async function fetchAnomalyForPoint(
  lat: number, lon: number, year: number
): Promise<number | null> {
  const cacheKey = `anomaly:${lat.toFixed(2)}:${lon.toFixed(2)}:${year}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const targetYear = Math.min(year, 2024); // ERA5 only goes to present

    // Fetch target year + baseline years in one request (ERA5 supports date ranges)
    const baselineStart = "1951-01-01";
    const baselineEnd   = "1980-12-31";
    const targetStart   = `${targetYear}-01-01`;
    const targetEnd     = `${targetYear}-12-31`;

    // Two requests: baseline + target year
    const [baselineRes, targetRes] = await Promise.all([
      fetchWithRetry(`${ERA5_BASE}?latitude=${lat}&longitude=${lon}&start_date=${baselineStart}&end_date=${baselineEnd}&daily=temperature_2m_mean&timezone=UTC`),
      fetchWithRetry(`${ERA5_BASE}?latitude=${lat}&longitude=${lon}&start_date=${targetStart}&end_date=${targetEnd}&daily=temperature_2m_mean&timezone=UTC`),
    ]);

    if (!baselineRes.ok || !targetRes.ok) return null;

    const [baselineData, targetData] = await Promise.all([
      baselineRes.json(),
      targetRes.json(),
    ]);

    const baselineTemps: number[] = (baselineData.daily?.temperature_2m_mean ?? []).filter((v: number | null) => v !== null);
    const targetTemps:   number[] = (targetData.daily?.temperature_2m_mean   ?? []).filter((v: number | null) => v !== null);

    if (baselineTemps.length === 0 || targetTemps.length === 0) return null;

    const baselineMean = baselineTemps.reduce((a, b) => a + b, 0) / baselineTemps.length;
    const targetMean   = targetTemps.reduce((a, b) => a + b, 0)   / targetTemps.length;
    const anomaly      = targetMean - baselineMean;

    cacheSet(cacheKey, anomaly);
    return anomaly;
  } catch {
    return null;
  }
}

let currentFetch: { year: number; controller: AbortController } | null = null;

/** Load anomalies for all countries for the given year.
 *  Updates progressively — calls listeners as each country resolves. */
export async function loadGlobalHeatmap(year: number): Promise<void> {
  // Cancel any in-flight fetch for a different year
  if (currentFetch && currentFetch.year !== year) {
    currentFetch.controller.abort();
    currentFetch = null;
  }
  if (currentFetch?.year === year) return; // already loading this year

  const controller = new AbortController();
  currentFetch = { year, controller };

  const countries = await loadCountries();

  // Process in batches of 5 with 200ms between batches to avoid rate limits
  const BATCH = 5;
  const DELAY = 200;

  for (let i = 0; i < countries.length; i += BATCH) {
    if (controller.signal.aborted) return;

    const batch = countries.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (c) => {
        const [lon, lat] = c.centroid;
        const anomaly = await fetchAnomalyForPoint(lat, lon, year);
        if (anomaly !== null && !controller.signal.aborted) {
          latestMap.set(c.name, anomaly);
          notify();
        }
      })
    );

    if (i + BATCH < countries.length) {
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  currentFetch = null;
}
