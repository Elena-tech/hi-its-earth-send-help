# Copilot Instructions — hi, it's earth. send help.

## Project Overview

An interactive 3D climate visualisation that lets users explore Earth's climate history (1850–2024) and future projections (2025–2100) through a rotating globe with real-time shader effects. The globe responds to climate data — ice caps shrink, land browns, oceans rise, atmosphere hazes — as users scrub through time.

**Live URL**: TBD (not yet deployed)

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| 3D | Three.js | 0.183.2 |
| Shaders | Custom GLSL (vertex + fragment) | — |
| Styling | Tailwind CSS + inline styles | 4.x |
| Language | TypeScript | 5.x |
| Fonts | Space Mono (headings/mono), Space Grotesk (body) | Google Fonts |
| Node.js | **Requires ≥20.9.0** | Use `nvm use 20` |

---

## Local Development

### Prerequisites
- **Node.js 20.9+** — The project uses Next.js 16 which requires Node ≥20.9.0
- If using nvm: `nvm install 20 && nvm use 20`

### Quick Start
```bash
cd hi-its-earth-send-help
npm install
npm run dev -- -p 3001   # Port 3001 (3000 often in use)
```

### For Copilot — Start Command
Always use this exact pattern (loads nvm first, uses port 3001):
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 20 && cd /Users/alexcatlin/Documents/VisualStudio/hi-its-earth-send-help && npm run dev -- -p 3001
```

### Kill Existing Process
```bash
lsof -ti :3001 | xargs kill -9 2>/dev/null; sleep 1
```

---

## Directory Structure

```
hi-its-earth-send-help/
├── app/
│   ├── layout.tsx              # Root layout (Google Fonts: Space Mono, Space Grotesk)
│   ├── page.tsx                # Main page — state management, animation loop, UI shell
│   └── globals.css             # Tailwind + global styles
├── components/earth/
│   ├── EarthScene.tsx          # Three.js canvas — globe, atmosphere, stars, drag rotation
│   ├── BottomBar.tsx           # ★ Active bottom UI — play controls, year slider, labels
│   ├── Timeline.tsx            # Standalone timeline (currently unused, kept for reference)
│   ├── PlayControls.tsx        # Standalone play/speed buttons (unused, merged into BottomBar)
│   ├── ControlPanel.tsx        # Right-side climate indicator panel (5 metrics with bars)
│   └── EventCard.tsx           # Slide-in card for historical climate events
├── lib/
│   ├── climateData.ts          # ★ All climate data, interpolation, SSP projections
│   ├── events.ts               # 18 historical climate events (1896–2024)
│   └── shaders.ts              # ★ GLSL shaders (earth, atmosphere, stars)
├── public/textures/
│   ├── earth_day.jpg           # Daytime earth texture
│   ├── earth_night.jpg         # Nighttime earth texture (city lights — currently unused in shader)
│   └── earth_clouds.jpg        # Cloud layer texture
└── package.json
```

**Active vs Unused Components:**
- `BottomBar.tsx` is the active bottom UI (play + speed + slider + labels)
- `Timeline.tsx` and `PlayControls.tsx` exist but are NOT rendered in `page.tsx`
- `ControlPanel.tsx` exists but is NOT rendered in `page.tsx`

---

## Core Architecture

### State Flow

```
page.tsx (state owner)
├── year: number (1850–2100)          — current year on timeline
├── scenario: Scenario                 — "optimistic" | "moderate" | "worst"
├── playing: boolean                   — animation running
├── speed: number                      — years per second (1, 5, 10, 25)
├── activeEvent: ClimateEvent | null  — currently displayed event card
└── isMobile: boolean                  — viewport < 640px

getClimateForYear(year, scenario) → ClimateValues
  → climate: ClimateState (passed to EarthScene as shader uniforms)
  → stats: rendered as stat cards in header
```

### Animation Loop
- `requestAnimationFrame` based, managed in `page.tsx`
- `fracYear` ref tracks continuous year (not rounded)
- Advances by `dt * speed` each frame
- Events trigger pauses (`pauseUntil` ref) with configurable duration per event
- Auto-stops at `YEAR_MAX` (2100)

### Three.js Scene (`EarthScene.tsx`)
- **Earth**: `SphereGeometry(1, 128, 128)` with custom `ShaderMaterial`
- **Atmosphere**: Backside `SphereGeometry(1.08, 64, 64)` with rim glow shader
- **Stars**: 10,000 `Points` with randomised size/brightness attributes
- **Camera**: `PerspectiveCamera` at z=4.8 (desktop) or z=9.0 (mobile)
- **Drag**: Pointer events track mouse/touch for manual rotation with velocity decay (0.93)
- **Auto-rotation**: `0.0008 rad/frame` when not dragging

### Shader Uniforms

| Uniform | Type | Range | Effect |
|---------|------|-------|--------|
| `uTemperature` | float | 0–1 | Land browning, ice colour, warming tint |
| `uCO2` | float | 0–1 | Atmosphere haze colour (clean blue → dirty orange) |
| `uIceMelt` | float | 0–1 | Ice cap edge latitude (0.80 → 0.35) |
| `uDeforestation` | float | 0–1 | Green land → brown/orange tint |
| `uSeaLevel` | float | 0–1 | Coastal darkening/flooding |
| `uTempAnomaly` | float | °C | Temperature heatmap overlay (blue/yellow/orange/red) |
| `uTime` | float | seconds | Cloud drift animation |

### Climate Data (`climateData.ts`)

**Historical Data Arrays** (all `[year, value][]`):
- `TEMP_HISTORY` — Global mean temp anomaly (°C vs pre-industrial), 1850–2024
- `CO2_HISTORY` — Atmospheric CO₂ (ppm), 1850–2024
- `ICE_HISTORY` — Arctic sea ice extent (M km²), 1850–2024
- `SEA_LEVEL_HISTORY` — Sea level rise (mm vs 1900), 1850–2024
- `DEFORESTATION_HISTORY` — Forest loss (% of 1850 cover), 1850–2024

**Projections** (`PROJECTIONS` object with `optimistic`, `moderate`, `worst` keys):
- Each scenario has arrays for temp, co2, ice, sea level, deforestation from 2025–2100
- Based on IPCC AR6 SSP scenarios (SSP1-2.6, SSP2-4.5, SSP5-8.5)

**Key Functions:**
- `interpolate(data, year)` — Linear interpolation between data points
- `getClimateForYear(year, scenario)` → `ClimateValues` — Returns both raw values and normalised 0–1 values for shader uniforms

**Normalisation Ranges:**
- Temperature: 0°C = 0, 4°C = 1
- CO₂: 280 ppm = 0, 800 ppm = 1
- Ice: 7.5 M km² = 0, 0 M km² = 1 (inverted — more melt = higher)
- Sea Level: 0 mm = 0, 2000 mm = 1
- Deforestation: 0% = 0, 50% = 1

### GLSL Shaders (`shaders.ts`)

**Earth Fragment Shader Features:**
- Day/night blend based on sun direction (procedural city lights on night side)
- Climate effects: land heat tint, deforestation browning, sea level flooding
- Ice caps: latitude-based with noise edge, shrinks with `uIceMelt`
- Cloud layer: drifting UV offset, colour shifts with CO₂
- Temperature heatmap overlay: Arctic amplification (3×), land/ocean differential (1.5×)
- Colour scale: blue (cooling) → yellow → orange → red → dark red (warming)
- Specular highlights on ocean surface
- CO₂ rim tint on atmosphere edge

**Atmosphere Fragment Shader:**
- Fresnel rim glow (pow 2.5)
- Clean blue → dirty orange based on CO₂

---

## Climate Events (`events.ts`)

18 events from 1896 to 2024 with:
- `year`, `title`, `body` — content
- `severity`: `"info"` | `"warning"` | `"critical"` — affects card border/glow colour
- `pauseMs` — how long to pause the animation (2500–6000ms)

`getEventsForYear(year)` — returns events within ±0.5 year proximity.

---

## Styling Conventions

### Design System
- **Background**: Pure black (`#000`)
- **Text**: White with varying opacity (0.9 primary, 0.6 secondary, 0.3 tertiary)
- **Font sizes**: 7–8px for labels, 9–11px for body, clamp() for responsive headings
- **Colors by metric**:
  - Temperature: `#ff6644` / `#ff4444`
  - CO₂: `#ff8c00`
  - Sea Level: `#4488ff`
  - Ice: `#00ccff`
  - Deforestation: `#44ff88`
- **Scenario colours**: Green `#44ff88` (SSP1-2.6), Yellow `#ffd700` (SSP2-4.5), Red `#ff4444` (SSP5-8.5)

### Component Styling
- All styling uses inline `style` objects (not CSS classes or Tailwind utilities in components)
- `globals.css` uses Tailwind for base reset and range input thumb styling
- Glassmorphism: `background: rgba(0,0,0,0.55-0.85)`, `backdropFilter: blur(10-16px)`
- Borders: `1px solid rgba(255,255,255,0.07-0.35)`
- Transitions: `0.2-0.8s ease` for state changes

### Responsive
- Mobile breakpoint: 640px (`isMobile` state in `page.tsx`)
- Mobile adaptations: stacked header, larger camera z-distance (9.0 vs 4.8)
- Safe area insets: `env(safe-area-inset-bottom)` for bottom bar

---

## Key Patterns

### Dynamic Import for Three.js
```tsx
const EarthScene = dynamic(() => import("@/components/earth/EarthScene"), { ssr: false });
```
Three.js must NOT be server-rendered. Always use `dynamic` with `{ ssr: false }`.

### Client Components
All components in `components/earth/` use `"use client"` directive. The main `page.tsx` also uses `"use client"`.

### Year Label Positioning
Year labels on the timeline are positioned absolutely to match the linear slider scale:
```tsx
const pos = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
// First label: no transform (align left)
// Last label: translateX(-100%) (align right)
// Middle labels: translateX(-50%) (center)
```
**Do NOT use `justify-content: space-between`** for year labels — the labels are not evenly spaced on the year scale.

### Drag vs Click Detection
When implementing click interactions on the Three.js canvas:
- Track `pointerdown` position and `pointerup` position
- Only fire click if distance < 5px (prevents drag from triggering click)
- The existing drag logic uses `isDragging` ref with velocity decay

### Texture Loading
Textures are loaded with `Three.TextureLoader` in a `useEffect`:
```tsx
const loader = new THREE.TextureLoader();
loader.load("/textures/earth_day.jpg", tex => { ... });
```
Textures are applied as uniforms to shader materials.

---

## Data Sources (Attribution)

Currently hardcoded; planned API integration (see PLAN.md):

| Data | Source | Reference |
|------|--------|-----------|
| Global temperature | NASA GISTEMP v4 | Hansen et al. (2010) |
| CO₂ concentration | NOAA / Mauna Loa | Keeling et al. |
| Arctic sea ice | NSIDC | National Snow & Ice Data Center |
| Sea level | CSIRO / NASA | Church & White (2011) |
| Deforestation | Global Forest Watch | Hansen et al. (2013) |
| SSP projections | IPCC AR6 | IPCC Sixth Assessment Report |
| Future data (planned) | Open-Meteo ERA5 + CMIP6 | Hersbach et al. (2020) |

---

## Planned Features (See PLAN.md)

1. **Real temperature data** — Open-Meteo API integration (no key required)
2. **Country drill-down** — Click globe → detect country → show temperature timeline
3. **Country heat overlay** — Colour countries on globe by temperature anomaly
4. **Heatmap visualisation** — Year × Month grid for selected country
5. **SSP projections per country** — CMIP6 data via Open-Meteo Climate API

---

## Development Notes

### Port Configuration
Port 3000 is typically in use (Reporting project). Use port 3001:
```bash
npm run dev -- -p 3001
```

### Node Version
Next.js 16 requires Node ≥20.9.0. The project was set up with:
```bash
nvm install 20
nvm use 20
```

### File Organization
- **New API code** → `lib/api/`
- **New geo/spatial code** → `lib/geo/`
- **New components** → `components/earth/`
- **Static data files** → `lib/data/` or `public/geo/`
- **Textures** → `public/textures/`

### Shader Development
- Shaders are stored as template literal strings in `lib/shaders.ts`
- Test shader changes with hot reload (Next.js watches the file)
- Use `console.log` on uniforms to debug values being passed to shaders
- The heatmap overlay in the earth fragment shader uses `uTempAnomaly` (actual °C value, can be negative)

### Performance Considerations
- Earth sphere: 128 segments is the sweet spot (64 too faceted, 256 too heavy on mobile)
- Stars: 10,000 points is fine; avoid >50,000
- Shader complexity: current shader has ~150 LOC fragment — keep under 200 for mobile GPU
- Textures: compressed JPGs, not PNGs. Keep each under 2MB
- Avoid re-creating Three.js objects in render — use refs and update uniforms only

---

*Update this file when new patterns, components, or data sources are added.*
