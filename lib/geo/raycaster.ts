/**
 * Globe raycaster utilities
 * Converts Three.js sphere intersection points to geographic coordinates.
 */

import * as THREE from "three";

/**
 * Convert a point on the unit sphere to geographic coordinates.
 * The sphere is oriented with Y-up, and the texture mapping uses:
 *   lon = atan2(-z, x)
 *   lat = asin(y)
 */
export function spherePointToLatLon(
  point: THREE.Vector3,
): { lat: number; lon: number } {
  // Normalise to unit sphere (in case of scaled geometry)
  const p = point.clone().normalize();

  const lat = Math.asin(p.y) * (180 / Math.PI);
  const lon = Math.atan2(-p.z, p.x) * (180 / Math.PI);

  return { lat, lon };
}

/**
 * Create a raycaster from a mouse/touch event on a Three.js canvas.
 * Returns the intersection with the earth sphere (if any).
 */
export function raycastGlobe(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  earthMesh: THREE.Mesh,
): THREE.Intersection | null {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(earthMesh);
  return intersects.length > 0 ? intersects[0] : null;
}
