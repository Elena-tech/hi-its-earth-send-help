/**
 * Country geometry utilities
 * Loads Natural Earth 110m TopoJSON, converts to GeoJSON features,
 * provides point-in-polygon lookup and centroid computation.
 */

import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CountryFeature {
  id: string;         // ISO numeric code
  name: string;
  centroid: [number, number]; // [lon, lat]
  polygons: [number, number][][]; // array of rings, each ring is [lon, lat][]
}

export interface CountryHit {
  name: string;
  lat: number;
  lon: number;
}

// ── State ─────────────────────────────────────────────────────────────────────

let countriesPromise: Promise<CountryFeature[]> | null = null;
let countriesCache: CountryFeature[] | null = null;

// ── Loading ───────────────────────────────────────────────────────────────────

function loadCountries(): Promise<CountryFeature[]> {
  if (countriesCache) return Promise.resolve(countriesCache);
  if (countriesPromise) return countriesPromise;

  countriesPromise = fetch("/geo/countries-110m.json")
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load TopoJSON: ${res.status}`);
      return res.json();
    })
    .then((topo: Topology) => {
      const geojson = topojson.feature(
        topo,
        topo.objects.countries as GeometryCollection,
      );

      const features: CountryFeature[] = [];

      for (const feature of geojson.features) {
        const props = feature.properties as Record<string, unknown> | null;
        const name = (props?.name as string) || `Country ${feature.id}`;
        const id = String(feature.id || "");

        // Extract all polygon rings
        const polygons: [number, number][][] = [];

        if (feature.geometry.type === "Polygon") {
          for (const ring of feature.geometry.coordinates) {
            polygons.push(ring as [number, number][]);
          }
        } else if (feature.geometry.type === "MultiPolygon") {
          for (const poly of feature.geometry.coordinates) {
            for (const ring of poly) {
              polygons.push(ring as [number, number][]);
            }
          }
        }

        // Compute centroid from largest polygon
        const centroid = computeCentroid(polygons);

        features.push({ id, name, centroid, polygons });
      }

      countriesCache = features;
      return features;
    });

  return countriesPromise;
}

// ── Point-in-Polygon ──────────────────────────────────────────────────────────

/**
 * Ray casting algorithm (Jordan curve theorem).
 * Tests whether a point is inside a polygon ring.
 */
function pointInRing(
  px: number,
  py: number,
  ring: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInCountry(
  lon: number,
  lat: number,
  country: CountryFeature,
): boolean {
  // Check outer rings (first ring of each polygon)
  for (const ring of country.polygons) {
    if (pointInRing(lon, lat, ring)) {
      return true;
    }
  }
  return false;
}

// ── Centroid ──────────────────────────────────────────────────────────────────

function computeCentroid(polygons: [number, number][][]): [number, number] {
  if (polygons.length === 0) return [0, 0];

  // Use the largest polygon (most points) for centroid
  let largest = polygons[0];
  for (const p of polygons) {
    if (p.length > largest.length) largest = p;
  }

  let sumLon = 0, sumLat = 0;
  for (const [lon, lat] of largest) {
    sumLon += lon;
    sumLat += lat;
  }
  const n = largest.length || 1;
  return [sumLon / n, sumLat / n];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pre-load the country geometry data.
 * Call this early to avoid delay on first click.
 */
export function preloadCountries(): void {
  loadCountries().catch(err => console.warn("Failed to preload countries:", err));
}

/**
 * Look up which country contains a given lat/lon.
 * Returns null if the point is in the ocean.
 */
export async function findCountryAt(
  lat: number,
  lon: number,
): Promise<CountryHit | null> {
  const countries = await loadCountries();

  for (const country of countries) {
    if (pointInCountry(lon, lat, country)) {
      return {
        name: country.name,
        lat: country.centroid[1],
        lon: country.centroid[0],
      };
    }
  }

  return null;
}

/**
 * Get all country names (for search/autocomplete).
 */
export async function getAllCountryNames(): Promise<string[]> {
  const countries = await loadCountries();
  return countries.map(c => c.name).sort();
}

/**
 * Get the full CountryFeature (with polygon data) for rendering outlines.
 */
export async function getCountryFeature(name: string): Promise<CountryFeature | null> {
  const countries = await loadCountries();
  return countries.find(c => c.name === name) || null;
}
