# Implementation Plan — Real Temperature Data & Country Drill-Down

## Overview

Transform the "hi, it's earth. send help." globe from static hardcoded data into a live, interactive climate explorer. Users will be able to click any country on the 3D earth to see its real historical temperature data visualised as a colour-graded timeline.

---

## Phase 1: Real Global Temperature Data (API Integration)

### Goal
Replace the hardcoded arrays in `climateData.ts` with live data from Open-Meteo and supplementary sources, while keeping the current UI exactly as-is.

### Data Sources

| Source | Data | Coverage | Auth | Notes |
|--------|------|----------|------|-------|
| **Open-Meteo Historical Weather API** | Daily/hourly temp, precipitation | 1940–present (ERA5) | None (free) | Primary source. No API key required. Rate limit ~600 req/min. |
| **Open-Meteo Climate API** | CMIP6 projections (SSP scenarios) | 2015–2100 | None | Future projections matching our SSP1-2.6, SSP2-4.5, SSP5-8.5 scenarios. |
| **NASA GISTEMP v4** | Global mean surface temp anomaly | 1880–present | None | CSV download, pre-processed. Good for global average validation. |
| **NOAA GHCNm** | Monthly station-based temp | 1850–present | None | Supplements Open-Meteo for pre-1940 data. |
| **Berkeley Earth** | Gridded temperature fields | 1850–present | None | Country-level averages available as free downloads. |

### Architecture

```
lib/
├── climateData.ts          # Existing — add API fetch layer, keep interpolation logic
├── api/
│   ├── openMeteo.ts        # Open-Meteo Historical + Climate API client
│   ├── nasaGistemp.ts      # NASA GISTEMP CSV parser (global average)
│   └── cache.ts            # In-memory + localStorage caching layer
├── data/
│   ├── globalMean.json     # Pre-computed global mean temp 1850–2024 (fallback)
│   └── countryMeta.json    # Country centroids, ISO codes, names
```

### Implementation Steps

1. **Create Open-Meteo API client** (`lib/api/openMeteo.ts`)
   - `fetchHistoricalTemp(lat, lon, startDate, endDate)` → daily mean temp
   - `fetchClimateProjection(lat, lon, scenario, startYear, endYear)` → CMIP6 projections
   - Handle rate limiting (max 600/min) with request queue
   - Return typed `TemperatureTimeSeries` interface

2. **Create caching layer** (`lib/api/cache.ts`)
   - In-memory Map for session (key: `${lat},${lon},${startYear}-${endYear}`)
   - `localStorage` persistence for repeat visits (TTL: 24 hours)
   - Pre-computed global mean as static JSON fallback for offline/error

3. **Pre-compute global dataset** (`lib/data/globalMean.json`)
   - Script to download NASA GISTEMP + Berkeley Earth global average (1850–2024)
   - Store as `[year, anomaly][]` — same shape as current `TEMP_HISTORY`
   - Bundle as static import (fallback when API unavailable)

4. **Adapt `climateData.ts`**
   - Keep `getClimateForYear()` signature identical
   - Add `getClimateForYearAsync(year, scenario, lat?, lon?)` that fetches real data
   - Global view: uses pre-computed global mean (no API call)
   - Country view: fetches from Open-Meteo on demand
   - CO₂, sea level, ice extent remain from curated datasets (not location-specific)

5. **Add loading states**
   - Skeleton/shimmer on stat cards while fetching
   - Use `React.Suspense` or TanStack Query for async data

### API Endpoints Used

```
# Historical Weather (ERA5 reanalysis, 1940+)
GET https://archive-api.open-meteo.com/v1/era5
  ?latitude=51.5&longitude=-0.1
  &start_date=1940-01-01&end_date=2024-12-31
  &daily=temperature_2m_mean
  &timezone=auto

# Climate Projections (CMIP6)
GET https://climate-api.open-meteo.com/v1/climate
  ?latitude=51.5&longitude=-0.1
  &start_date=2025-01-01&end_date=2100-12-31
  &models=EC_Earth3P_HR
  &daily=temperature_2m_mean
```

---

## Phase 2: Country Geometry & Click Detection

### Goal
Detect which country the user clicks on the 3D globe, highlight it, and open a detail panel.

### Architecture

```
lib/
├── geo/
│   ├── countries.ts        # GeoJSON loader + country lookup
│   ├── raycaster.ts        # Three.js raycaster → lat/lon → country
│   └── countryMesh.ts      # Generate highlight mesh for selected country
public/
├── geo/
│   └── countries-110m.json # TopoJSON world countries (Natural Earth, ~300KB)
```

### Implementation Steps

1. **Add country geometry data**
   - Use Natural Earth 110m TopoJSON (~300KB gzipped)
   - Or simplified GeoJSON with just country boundaries
   - Store in `public/geo/` for static serving

2. **Implement raycaster → lat/lon conversion** (`lib/geo/raycaster.ts`)
   - On click/tap on the Three.js canvas:
     - Cast ray from camera through mouse/touch point
     - Intersect with earth sphere (radius 1)
     - Convert intersection point (x, y, z) to (lat, lon):
       ```
       lat = asin(y) * 180 / π
       lon = atan2(-z, x) * 180 / π
       ```
   - Distinguish click from drag (track mouse distance between down/up)

3. **Implement lat/lon → country lookup** (`lib/geo/countries.ts`)
   - Load TopoJSON, convert to GeoJSON features
   - Point-in-polygon test: is `(lon, lat)` inside any country polygon?
   - Use a spatial index (simple bounding box pre-filter) for performance
   - Return: `{ iso: "GB", name: "United Kingdom", centroid: [lat, lon] }`
   - Library option: `@turf/boolean-point-in-polygon` (~5KB) or hand-roll winding number

4. **Highlight selected country on globe** (`lib/geo/countryMesh.ts`)
   - Generate a Three.js `LineSegments` mesh from the country's polygon boundary
   - Project GeoJSON coords onto sphere surface (lat/lon → 3D point at radius 1.002)
   - Style: glowing outline (additive blending, animated pulse)
   - Add/remove from scene on selection change

5. **Update `EarthScene.tsx`**
   - Add `onCountryClick(iso: string, name: string, lat: number, lon: number)` callback
   - Register `pointerdown`/`pointerup` on the renderer DOM element
   - Track drag distance; only fire click if distance < 5px threshold
   - Smoothly rotate globe to center the clicked country (SLERP camera)

### Dependencies

| Package | Size | Purpose |
|---------|------|---------|
| `topojson-client` | ~7KB | Convert TopoJSON → GeoJSON |
| `@turf/boolean-point-in-polygon` | ~5KB | Point-in-polygon test |
| `@turf/helpers` | ~3KB | GeoJSON type helpers |

**Alternative (zero-dependency):** Pre-compute a 360×180 grid image where each pixel encodes a country ID. On click, convert lat/lon to pixel coords and read the country ID. Instant lookup, ~100KB PNG.

---

## Phase 3: Country Detail Panel

### Goal
Show a slide-out panel with real temperature data for the selected country, including a colour-graded timeline visualisation.

### UI Design

```
┌─────────────────────────────────┐
│  ← Back to Globe                │
│                                 │
│  🇬🇧 UNITED KINGDOM             │
│  51.5°N, 0.1°W                  │
│                                 │
│  Current Anomaly: +1.42°C       │
│  vs 1850-1900 baseline          │
│                                 │
│  ┌─────────────────────────────┐│
│  │  TEMPERATURE TIMELINE       ││
│  │                             ││
│  │  1940 ░░░▒▒▒▓▓▓███████████ ││
│  │       ↑ blue    yellow  red ││
│  │                     ↑ 2024  ││
│  │                             ││
│  │  ─── Baseline (1951-1980)   ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  MONTHLY BREAKDOWN          ││
│  │  [mini heatmap grid]        ││
│  │  rows = years, cols = months││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  PROJECTIONS (2025-2100)    ││
│  │  SSP1-2.6 ──── +1.8°C      ││
│  │  SSP2-4.5 ──── +2.7°C      ││
│  │  SSP5-8.5 ──── +4.9°C      ││
│  └─────────────────────────────┘│
│                                 │
│  Data: Open-Meteo ERA5 / CMIP6 │
└─────────────────────────────────┘
```

### Components

```
components/earth/
├── CountryPanel.tsx        # Slide-out side panel
├── TempTimeline.tsx        # Horizontal colour-graded bar (1940–2024)
├── TempHeatmap.tsx         # Year × Month heatmap grid
├── TempProjections.tsx     # SSP scenario comparison chart
└── CountryHighlight.tsx    # Globe overlay mesh for selected country
```

### Implementation Steps

1. **Create `CountryPanel.tsx`**
   - Slide in from right (desktop) or bottom sheet (mobile)
   - Accept: `iso`, `name`, `lat`, `lon`
   - Fetch data via Open-Meteo on mount
   - Three sections: Timeline, Heatmap, Projections
   - Framer Motion for slide animation (or CSS transitions)

2. **Create `TempTimeline.tsx`** — The Colour Bar
   - Horizontal bar where each pixel column = 1 year
   - Colour scale: blue (< -0.5°C) → white (0°C) → yellow (+1°C) → orange (+2°C) → red (+3°C) → dark red (+4°C+)
   - Use HTML5 Canvas for pixel-level control
   - Interactive: hover to see year + exact anomaly
   - Baseline period marked (1951-1980 average)

3. **Create `TempHeatmap.tsx`** — Monthly Grid
   - Rows = years (1940–2024), Columns = months (Jan–Dec)
   - Each cell coloured by monthly mean temp anomaly
   - Same colour scale as timeline
   - Shows seasonal patterns and year-over-year warming
   - Render with CSS Grid or Canvas

4. **Create `TempProjections.tsx`** — Future Scenarios
   - Three SSP lines diverging from 2024
   - Line chart or gradient bars
   - Data from Open-Meteo Climate API (CMIP6)
   - Show end-of-century temperature for each scenario

5. **Wire up state in `page.tsx`**
   - New state: `selectedCountry: { iso, name, lat, lon } | null`
   - When set: render `CountryPanel`, dim/blur the globe slightly
   - Back button or click-away to close

### Data Flow

```
User clicks globe
  → raycaster finds intersection point
  → convert to (lat, lon)
  → point-in-polygon lookup → country ISO + name
  → set selectedCountry state
  → CountryPanel mounts
  → fetches Open-Meteo ERA5 data for country centroid
  → renders TempTimeline + TempHeatmap + TempProjections
```

---

## Phase 4: Enhanced Globe Visualisation

### Goal
When a country is selected, visualise its temperature data directly on the globe surface (not just in the panel).

### Features

1. **Country heat overlay**
   - When selected, render the country polygon as a mesh on the globe surface
   - Colour the mesh based on the year slider → temperature anomaly for that year
   - Same colour scale as the panel timeline
   - Animate colour change as user scrubs the timeline

2. **Neighbouring comparison**
   - Subtly colour adjacent countries too (dimmer)
   - Shows regional warming patterns at a glance

3. **Global heatmap mode** (toggle)
   - Colour all countries by their temperature anomaly for the selected year
   - Uses pre-computed dataset (Berkeley Earth country averages)
   - Heavy data: load on demand, ~2MB per decade

---

## Phase 5: Polish & Performance

### Optimisations
- **Request batching**: Aggregate nearby lat/lon queries into single API calls
- **Service Worker**: Cache API responses for offline use
- **WebGL instancing**: Render country outlines efficiently
- **Lazy loading**: Load TopoJSON and heavy datasets only when user interacts
- **Progressive enhancement**: Works without API data (falls back to bundled JSON)

### UX Improvements
- Keyboard navigation (arrow keys to move between countries)
- Search bar: type country name → zoom to it
- Share URL with country pre-selected (`?country=GB&year=2020`)
- Mobile: bottom sheet for country panel, pinch-to-zoom preserved

---

## File Changes Summary

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| 1 | `lib/api/openMeteo.ts`, `lib/api/cache.ts`, `lib/data/globalMean.json`, `lib/data/countryMeta.json` | `lib/climateData.ts`, `package.json` |
| 2 | `lib/geo/countries.ts`, `lib/geo/raycaster.ts`, `lib/geo/countryMesh.ts`, `public/geo/countries-110m.json` | `components/earth/EarthScene.tsx`, `package.json` |
| 3 | `components/earth/CountryPanel.tsx`, `components/earth/TempTimeline.tsx`, `components/earth/TempHeatmap.tsx`, `components/earth/TempProjections.tsx` | `app/page.tsx` |
| 4 | `lib/geo/countryHeatOverlay.ts` | `components/earth/EarthScene.tsx`, `lib/shaders.ts` |
| 5 | — | Various (performance optimisations) |

### New Dependencies

```json
{
  "topojson-client": "^3.1.0",
  "@turf/boolean-point-in-polygon": "^7.0.0",
  "@turf/helpers": "^7.0.0",
  "@types/topojson-client": "^3.1.0"
}
```

---

## Implementation Order (Recommended)

1. **Phase 1** — API client + caching (can work independently, validates data flow)
2. **Phase 2** — Click detection + country lookup (core interaction)
3. **Phase 3** — Country panel with visualisations (main feature delivery)
4. **Phase 4** — Globe overlays (enhancement)
5. **Phase 5** — Polish (iteration)

**Estimated effort**: Phase 1 (~1 day), Phase 2 (~1 day), Phase 3 (~2 days), Phase 4 (~1 day), Phase 5 (~1 day)

---

## API Rate Limits & Costs

| Service | Limit | Cost |
|---------|-------|------|
| Open-Meteo Historical | 10,000 req/day (free tier) | Free (open source) |
| Open-Meteo Climate | Same | Free |
| NASA GISTEMP | Unlimited (static CSV) | Free |
| Berkeley Earth | Unlimited (static downloads) | Free |

No API keys required for any of these sources. The entire data pipeline is free and open.
