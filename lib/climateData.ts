/**
 * Real Climate Data
 *
 * Sources:
 * - Temperature: NASA GISS Surface Temperature Analysis (GISTEMP v4)
 * - CO₂: NOAA Mauna Loa Observatory + ice core records
 * - Sea Ice: NSIDC Arctic Sea Ice Index (September minimum)
 * - Sea Level: NASA/CSIRO satellite + tide gauge records
 * - Deforestation: Global Forest Watch / FAO
 * - Projections: IPCC AR6 (2021) SSP scenarios
 */

// ── Historical data ───────────────────────────────────────────────────────────
// [year, value] pairs — interpolated for any year in range

// Temperature anomaly vs 1850–1900 baseline (°C)
// Source: NASA GISS GISTEMP v4
const TEMP_HISTORY: [number, number][] = [
  [1850, 0.00], [1860, -0.07], [1870, -0.10], [1880, -0.13],
  [1890, -0.18], [1900, -0.08], [1910, -0.27], [1920, -0.08],
  [1930,  0.02], [1940,  0.10], [1950,  0.02], [1960,  0.02],
  [1970,  0.03], [1980,  0.26], [1990,  0.44], [2000,  0.42],
  [2005,  0.67], [2010,  0.72], [2015,  0.90], [2016,  1.01],
  [2020,  1.02], [2023,  1.17], [2024,  1.45],
];

// CO₂ concentration (ppm) — Mauna Loa + ice cores pre-1958
const CO2_HISTORY: [number, number][] = [
  [1850, 285], [1870, 288], [1890, 293], [1900, 296],
  [1910, 300], [1920, 303], [1930, 307], [1940, 310],
  [1950, 311], [1960, 317], [1970, 326], [1980, 339],
  [1990, 354], [2000, 370], [2005, 380], [2010, 390],
  [2015, 401], [2019, 412], [2020, 414], [2022, 419],
  [2023, 421], [2024, 422],
];

// Arctic sea ice extent — September minimum (million km²)
// Source: NSIDC
const ICE_HISTORY: [number, number][] = [
  [1850, 8.2], [1900, 8.0], [1950, 7.8], [1979, 7.5],
  [1980, 7.5], [1985, 7.0], [1990, 6.5], [1995, 6.3],
  [2000, 6.3], [2005, 5.6], [2007, 4.3], [2010, 4.9],
  [2012, 3.4], [2015, 4.6], [2016, 4.1], [2018, 4.6],
  [2020, 3.9], [2022, 5.0], [2023, 4.2], [2024, 4.3],
];

// Sea level rise vs 1900 baseline (mm)
// Source: CSIRO / NASA satellite altimetry
const SEA_LEVEL_HISTORY: [number, number][] = [
  [1850, -40], [1900, 0], [1910, 8], [1920, 16],
  [1930, 25], [1940, 40], [1950, 60], [1960, 75],
  [1970, 90], [1980, 105], [1990, 130], [2000, 155],
  [2005, 170], [2010, 185], [2015, 205], [2020, 220],
  [2022, 227], [2024, 232],
];

// Forest cover loss — cumulative % of original 1850 forest (0–100)
// Source: Global Forest Watch / FAO
const DEFORESTATION_HISTORY: [number, number][] = [
  [1850, 0], [1870, 2], [1890, 4], [1900, 6],
  [1910, 8], [1920, 11], [1930, 13], [1940, 16],
  [1950, 19], [1960, 22], [1970, 26], [1980, 30],
  [1990, 35], [2000, 39], [2005, 41], [2010, 43],
  [2015, 45], [2020, 47], [2023, 48], [2024, 48.5],
];

// ── IPCC AR6 Projections 2024–2100 ───────────────────────────────────────────
// Three scenarios: optimistic (SSP1-2.6), moderate (SSP2-4.5), worst (SSP5-8.5)

export type Scenario = "optimistic" | "moderate" | "worst";

const PROJECTIONS: Record<Scenario, {
  temp:  [number, number][];
  co2:   [number, number][];
  ice:   [number, number][];
  sea:   [number, number][];
  defor: [number, number][];
}> = {
  optimistic: { // SSP1-2.6 — emissions peak now, net-zero by 2050
    temp:  [[2024, 1.45], [2030, 1.5], [2040, 1.6], [2050, 1.6], [2075, 1.7], [2100, 1.8]],
    co2:   [[2024, 422],  [2030, 430], [2040, 430], [2050, 420], [2075, 400], [2100, 380]],
    ice:   [[2024, 4.3],  [2030, 3.8], [2040, 3.0], [2050, 2.0], [2075, 1.5], [2100, 1.0]],
    sea:   [[2024, 232],  [2030, 255], [2040, 290], [2050, 340], [2075, 430], [2100, 500]],
    defor: [[2024, 48.5], [2030, 48],  [2040, 46],  [2050, 43],  [2075, 38],  [2100, 35]],
  },
  moderate: { // SSP2-4.5 — current policies continue
    temp:  [[2024, 1.45], [2030, 1.6], [2040, 1.9], [2050, 2.2], [2075, 2.5], [2100, 2.7]],
    co2:   [[2024, 422],  [2030, 440], [2040, 480], [2050, 520], [2075, 560], [2100, 560]],
    ice:   [[2024, 4.3],  [2030, 3.5], [2040, 2.2], [2050, 0.5], [2075, 0.1], [2100, 0.1]],
    sea:   [[2024, 232],  [2030, 265], [2040, 320], [2050, 400], [2075, 570], [2100, 750]],
    defor: [[2024, 48.5], [2030, 50],  [2040, 53],  [2050, 55],  [2075, 58],  [2100, 60]],
  },
  worst: { // SSP5-8.5 — high emissions, no action
    temp:  [[2024, 1.45], [2030, 1.7], [2040, 2.2], [2050, 2.9], [2075, 3.8], [2100, 4.4]],
    co2:   [[2024, 422],  [2030, 470], [2040, 560], [2050, 670], [2075, 790], [2100, 850]],
    ice:   [[2024, 4.3],  [2030, 3.0], [2040, 0.5], [2050, 0.0], [2075, 0.0], [2100, 0.0]],
    sea:   [[2024, 232],  [2030, 270], [2040, 360], [2050, 480], [2075, 750], [2100, 1000]],
    defor: [[2024, 48.5], [2030, 52],  [2040, 58],  [2050, 65],  [2075, 75],  [2100, 80]],
  },
};

// ── Interpolation ─────────────────────────────────────────────────────────────
function interpolate(data: [number, number][], year: number): number {
  if (year <= data[0][0]) return data[0][1];
  if (year >= data[data.length - 1][0]) return data[data.length - 1][1];
  for (let i = 0; i < data.length - 1; i++) {
    const [y0, v0] = data[i];
    const [y1, v1] = data[i + 1];
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0);
      return v0 + (v1 - v0) * t;
    }
  }
  return data[data.length - 1][1];
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface ClimateValues {
  year: number;
  // Raw values
  tempC: number;       // °C anomaly vs pre-industrial
  co2Ppm: number;      // ppm
  iceExtent: number;   // million km²
  seaLevelMm: number;  // mm above 1900
  deforPct: number;    // % of original forest lost
  // Normalised 0–1 for shader uniforms
  temperature: number;
  co2: number;
  iceMelt: number;
  seaLevel: number;
  deforestation: number;
}

const ICE_BASELINE = 8.2; // 1850 value — full reference

export function getClimateForYear(year: number, scenario: Scenario = "moderate"): ClimateValues {
  const isHistorical = year <= 2024;

  const tempC       = isHistorical ? interpolate(TEMP_HISTORY,          year) : interpolate(PROJECTIONS[scenario].temp,  year);
  const co2Ppm      = isHistorical ? interpolate(CO2_HISTORY,           year) : interpolate(PROJECTIONS[scenario].co2,   year);
  const iceExtent   = isHistorical ? interpolate(ICE_HISTORY,           year) : interpolate(PROJECTIONS[scenario].ice,   year);
  const seaLevelMm  = isHistorical ? interpolate(SEA_LEVEL_HISTORY,     year) : interpolate(PROJECTIONS[scenario].sea,   year);
  const deforPct    = isHistorical ? interpolate(DEFORESTATION_HISTORY, year) : interpolate(PROJECTIONS[scenario].defor, year);

  return {
    year,
    tempC,
    co2Ppm,
    iceExtent,
    seaLevelMm,
    deforPct,
    // Normalise for shader (clamp 0-1)
    temperature:   Math.max(0, Math.min(1, (tempC + 0.3) / 4.7)),          // –0.3°C → +4.4°C
    co2:           Math.max(0, Math.min(1, (co2Ppm - 280) / 570)),         // 280→850 ppm
    iceMelt:       Math.max(0, Math.min(1, 1 - (iceExtent / ICE_BASELINE))), // 0=full ice, 1=no ice
    seaLevel:      Math.max(0, Math.min(1, (seaLevelMm + 40) / 1040)),     // –40→1000 mm
    deforestation: Math.max(0, Math.min(1, deforPct / 80)),                // 0→80%
  };
}

export const YEAR_MIN = 1850;
export const YEAR_MAX = 2100;
