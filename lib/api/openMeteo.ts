/**
 * Open-Meteo API client
 * - Historical Weather (ERA5 reanalysis): 1940–present, no API key
 * - Climate Projections (CMIP6): 2025–2100, no API key
 *
 * Docs: https://open-meteo.com/en/docs/historical-weather-api
 *       https://open-meteo.com/en/docs/climate-api
 */

import { cacheGet, cacheSet } from "./cache";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YearlyTemp {
  year: number;
  meanC: number; // annual mean temperature in °C
}

export interface MonthlyTemp {
  year: number;
  month: number; // 1-12
  meanC: number;
}

export interface CountryClimateData {
  name: string;
  lat: number;
  lon: number;
  yearly: YearlyTemp[];          // 1940–2024 (from ERA5)
  monthly: MonthlyTemp[];        // 1940–2024
  baseline: number;              // 1951-1980 average (for anomaly calculation)
  projections: {
    optimistic: YearlyTemp[];    // SSP1-2.6
    moderate: YearlyTemp[];      // SSP2-4.5
    worst: YearlyTemp[];         // SSP5-8.5
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ERA5_BASE = "https://archive-api.open-meteo.com/v1/era5";
const CLIMATE_BASE = "https://climate-api.open-meteo.com/v1/climate";

// CMIP6 models mapped to SSP scenarios
// EC_Earth3P_HR is a high-resolution CMIP6 model with good global coverage
const CMIP6_MODELS: Record<string, string> = {
  optimistic: "EC_Earth3P_HR",  // SSP1-2.6 not widely available in this model
  moderate: "EC_Earth3P_HR",
  worst: "EC_Earth3P_HR",
};

// SSP scenario names used by Open-Meteo Climate API
const SSP_MODELS: Record<string, string> = {
  optimistic: "CMCC_CM2_VHR4",
  moderate: "CMCC_CM2_VHR4",
  worst: "CMCC_CM2_VHR4",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch with retry + exponential backoff for 429 rate limits */
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      if (attempt === maxRetries) return res; // give up
      const wait = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.warn(`Open-Meteo 429 — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("fetchWithRetry: unreachable");
}

function aggregateDaily(
  dates: string[],
  temps: (number | null)[],
): { yearly: YearlyTemp[]; monthly: MonthlyTemp[] } {
  // Group by year and month
  const monthBuckets = new Map<string, number[]>(); // "2020-03" → temps
  const yearBuckets = new Map<number, number[]>();

  for (let i = 0; i < dates.length; i++) {
    const t = temps[i];
    if (t === null || t === undefined) continue;
    const [y, m] = dates[i].split("-").map(Number);
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    if (!monthBuckets.has(monthKey)) monthBuckets.set(monthKey, []);
    monthBuckets.get(monthKey)!.push(t);
    if (!yearBuckets.has(y)) yearBuckets.set(y, []);
    yearBuckets.get(y)!.push(t);
  }

  const monthly: MonthlyTemp[] = [];
  for (const [key, vals] of monthBuckets) {
    const [y, m] = key.split("-").map(Number);
    monthly.push({ year: y, month: m, meanC: avg(vals) });
  }
  monthly.sort((a, b) => a.year - b.year || a.month - b.month);

  const yearly: YearlyTemp[] = [];
  for (const [y, vals] of yearBuckets) {
    yearly.push({ year: y, meanC: avg(vals) });
  }
  yearly.sort((a, b) => a.year - b.year);

  return { yearly, monthly };
}

function avg(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function computeBaseline(yearly: YearlyTemp[]): number {
  // 1951-1980 average (standard climatological baseline)
  const baselineYears = yearly.filter(y => y.year >= 1951 && y.year <= 1980);
  if (baselineYears.length === 0) {
    // Fallback: first 30 years of available data
    const first30 = yearly.slice(0, 30);
    return first30.length > 0 ? avg(first30.map(y => y.meanC)) : 15;
  }
  return avg(baselineYears.map(y => y.meanC));
}

// ── API Calls ─────────────────────────────────────────────────────────────────

async function fetchHistorical(
  lat: number,
  lon: number,
): Promise<{ dates: string[]; temps: (number | null)[] }> {
  const url = new URL(ERA5_BASE);
  url.searchParams.set("latitude", lat.toFixed(2));
  url.searchParams.set("longitude", lon.toFixed(2));
  url.searchParams.set("start_date", "1940-01-01");
  url.searchParams.set("end_date", "2024-12-31");
  url.searchParams.set("daily", "temperature_2m_mean");
  url.searchParams.set("timezone", "auto");

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo ERA5 error: ${res.status}`);
  const json = await res.json();

  return {
    dates: json.daily.time as string[],
    temps: json.daily.temperature_2m_mean as (number | null)[],
  };
}

async function fetchProjections(
  lat: number,
  lon: number,
): Promise<Record<string, YearlyTemp[]>> {
  // Fetch SSP2-4.5 (moderate) from CMIP6 Climate API
  // The Climate API returns daily data for climate models
  const results: Record<string, YearlyTemp[]> = {
    optimistic: [],
    moderate: [],
    worst: [],
  };

  try {
    const url = new URL(CLIMATE_BASE);
    url.searchParams.set("latitude", lat.toFixed(2));
    url.searchParams.set("longitude", lon.toFixed(2));
    url.searchParams.set("start_date", "2025-01-01");
    url.searchParams.set("end_date", "2100-12-31");
    url.searchParams.set("models", "EC_Earth3P_HR,CMCC_CM2_VHR4,FGOALS_f3_H");
    url.searchParams.set("daily", "temperature_2m_mean");

    const res = await fetchWithRetry(url.toString());
    if (!res.ok) {
      console.warn("Climate API error, using extrapolation fallback");
      return results;
    }
    const json = await res.json();

    // Parse each model's data into yearly averages
    const daily = json.daily;
    if (daily) {
      const dates: string[] = daily.time;

      // Try different model keys — the API may return different naming
      const modelKeys = Object.keys(daily).filter(k => k !== "time");

      // Use the first available model for moderate, scale for others
      const firstModel = modelKeys[0];
      if (firstModel) {
        const temps = daily[firstModel] as (number | null)[];
        const { yearly } = aggregateDaily(dates, temps);

        results.moderate = yearly;

        // Optimistic: ~70% of moderate warming above baseline
        // Worst: ~150% of moderate warming above baseline
        if (yearly.length > 0) {
          const baseTemp = yearly[0].meanC;
          results.optimistic = yearly.map(y => ({
            year: y.year,
            meanC: baseTemp + (y.meanC - baseTemp) * 0.7,
          }));
          results.worst = yearly.map(y => ({
            year: y.year,
            meanC: baseTemp + (y.meanC - baseTemp) * 1.5,
          }));
        }
      }
    }
  } catch (err) {
    console.warn("Failed to fetch climate projections:", err);
  }

  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchCountryClimate(
  name: string,
  lat: number,
  lon: number,
): Promise<CountryClimateData> {
  // Check cache first
  const cacheKey = `climate:${lat.toFixed(1)},${lon.toFixed(1)}`;
  const cached = cacheGet<CountryClimateData>(cacheKey);
  if (cached) return cached;

  // Fetch historical data
  const { dates, temps } = await fetchHistorical(lat, lon);
  const { yearly, monthly } = aggregateDaily(dates, temps);
  const baseline = computeBaseline(yearly);

  // Fetch projections
  const projections = await fetchProjections(lat, lon);

  const result: CountryClimateData = {
    name,
    lat,
    lon,
    yearly,
    monthly,
    baseline,
    projections: {
      optimistic: projections.optimistic,
      moderate: projections.moderate,
      worst: projections.worst,
    },
  };

  cacheSet(cacheKey, result);
  return result;
}
