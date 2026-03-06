/**
 * Renders country anomalies onto a canvas texture for the globe shader.
 * Produces a 2048×1024 equirectangular canvas where each country is filled
 * with its temperature anomaly colour. Transparent where no data.
 */

import { loadCountries } from "./countries";
import type { AnomalyMap } from "../api/globalHeatmap";

export const HEATMAP_W = 2048;
export const HEATMAP_H = 1024;

// Anomaly → RGBA colour (matches CountryPanel colour scale)
function anomalyToRGBA(anomaly: number): [number, number, number, number] {
  const alpha = Math.min(0.75, 0.2 + Math.abs(anomaly) * 0.15);
  if (anomaly <= -2.0) return [8,   48,  107, alpha * 255];
  if (anomaly <= -1.5) return [33,  102, 172, alpha * 255];
  if (anomaly <= -1.0) return [67,  147, 195, alpha * 255];
  if (anomaly <= -0.5) return [146, 197, 222, alpha * 255];
  if (anomaly <=  0.0) return [209, 229, 240, alpha * 255];
  if (anomaly <=  0.5) return [253, 219, 199, alpha * 255];
  if (anomaly <=  1.0) return [239, 138,  98, alpha * 255];
  if (anomaly <=  1.5) return [214,  96,  77, alpha * 255];
  if (anomaly <=  2.0) return [178,  24,  43, alpha * 255];
  if (anomaly <=  3.0) return [160,  16,  32, alpha * 255];
  return                      [103,   0,  31, alpha * 255];
}

// Convert lon/lat to canvas pixel (equirectangular projection)
function lonLatToXY(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * HEATMAP_W;
  const y = ((90 - lat) / 180) * HEATMAP_H;
  return [x, y];
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

export function getHeatmapCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width  = HEATMAP_W;
    canvas.height = HEATMAP_H;
    ctx = canvas.getContext("2d")!;
  }
  return canvas;
}

export async function renderHeatmapToCanvas(anomalies: AnomalyMap): Promise<HTMLCanvasElement> {
  const cv = getHeatmapCanvas();
  const context = ctx!;

  // Clear to transparent
  context.clearRect(0, 0, HEATMAP_W, HEATMAP_H);

  if (anomalies.size === 0) return cv;

  const countries = await loadCountries();

  for (const country of countries) {
    const anomaly = anomalies.get(country.name);
    if (anomaly === undefined) continue;

    const [r, g, b, a] = anomalyToRGBA(anomaly);
    context.fillStyle = `rgba(${r},${g},${b},${a / 255})`;

    // Draw each polygon ring
    for (const ring of country.polygons) {
      if (ring.length < 3) continue;

      context.beginPath();
      const [startLon, startLat] = ring[0];
      const [sx, sy] = lonLatToXY(startLon, startLat);
      context.moveTo(sx, sy);

      for (let i = 1; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const [x, y] = lonLatToXY(lon, lat);
        context.lineTo(x, y);
      }

      context.closePath();
      context.fill();
    }
  }

  return cv;
}
