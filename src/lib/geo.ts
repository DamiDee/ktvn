import type { Coordinates, RoutePath } from "@/types/models";

/** Geometry helpers shared by the map renderer and the ride simulator. */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpCoordinates(
  a: Coordinates,
  b: Coordinates,
  t: number,
): Coordinates {
  return { lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Bearing in degrees (0 = north, clockwise). Used to rotate the vehicle
 * marker so it faces its direction of travel.
 */
export function bearingDegrees(from: Coordinates, to: Coordinates): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Deterministic pseudo-random in [0,1) so routes are stable across renders. */
function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Build a plausible road-like path between two points.
 *
 * Real routing comes from the map provider once one is configured; this keeps
 * the simulation honest-looking in the meantime — a gentle arc with small
 * lateral jogs rather than a straight line.
 */
export function buildRoute(
  origin: Coordinates,
  destination: Coordinates,
  options: { seed?: string; segments?: number; curvature?: number } = {},
): RoutePath {
  const { seed = "route", segments = 48, curvature = 0.16 } = options;
  const random = seededRandom(hashString(seed) || 1);

  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;

  // Perpendicular offset vector for the arc.
  const perpLat = -dLng;
  const perpLng = dLat;

  const arcDirection = random() > 0.5 ? 1 : -1;
  const arcMagnitude = curvature * (0.6 + random() * 0.8) * arcDirection;

  // A couple of gentle waypoints so the line reads like streets, not a wire.
  const jogCount = 3;
  const jogs = Array.from({ length: jogCount }, () => (random() - 0.5) * 0.055);

  const points: Coordinates[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;

    // Quadratic-ish arc: peaks at the middle, zero at both ends.
    const arc = Math.sin(t * Math.PI) * arcMagnitude;

    // Layered low-frequency wobble, damped at the endpoints.
    const damp = Math.sin(t * Math.PI);
    let wobble = 0;
    for (let j = 0; j < jogCount; j += 1) {
      wobble += Math.sin(t * Math.PI * (2 + j * 1.7)) * jogs[j] * damp;
    }

    const offset = arc + wobble;

    points.push({
      lat: origin.lat + dLat * t + perpLat * offset,
      lng: origin.lng + dLng * t + perpLng * offset,
    });
  }

  points[0] = { ...origin };
  points[points.length - 1] = { ...destination };

  const distanceKm = pathLengthKm(points);
  // Urban average around 26 km/h, floored so short hops still read sensibly.
  const durationMinutes = Math.max(4, Math.round((distanceKm / 26) * 60));

  return { points, distanceKm, durationMinutes };
}

export function pathLengthKm(points: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

/** Cumulative distance at each vertex — precomputed for constant-speed travel. */
export function cumulativeDistances(points: Coordinates[]): number[] {
  const distances = [0];
  for (let i = 1; i < points.length; i += 1) {
    distances.push(distances[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  return distances;
}

export interface PointOnPath {
  position: Coordinates;
  /** Heading in degrees for marker rotation. */
  heading: number;
  /** Index of the segment the point currently sits on. */
  segmentIndex: number;
}

/**
 * Position along a path at progress `t` in [0,1], measured by distance so
 * the marker moves at a constant speed rather than per-vertex.
 */
export function pointAlongPath(
  points: Coordinates[],
  t: number,
  cumulative?: number[],
): PointOnPath {
  if (points.length === 0) {
    return { position: { lat: 0, lng: 0 }, heading: 0, segmentIndex: 0 };
  }
  if (points.length === 1) {
    return { position: points[0], heading: 0, segmentIndex: 0 };
  }

  const distances = cumulative ?? cumulativeDistances(points);
  const total = distances[distances.length - 1];
  const target = clamp(t, 0, 1) * total;

  if (total === 0) {
    return { position: points[0], heading: 0, segmentIndex: 0 };
  }

  // Binary search for the segment containing `target`.
  let low = 0;
  let high = distances.length - 1;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (distances[mid] <= target) low = mid;
    else high = mid;
  }

  const segmentStart = distances[low];
  const segmentEnd = distances[low + 1];
  const segmentLength = segmentEnd - segmentStart;
  const localT = segmentLength === 0 ? 0 : (target - segmentStart) / segmentLength;

  return {
    position: lerpCoordinates(points[low], points[low + 1], localT),
    heading: bearingDegrees(points[low], points[low + 1]),
    segmentIndex: low,
  };
}

/** Slice a path from progress 0 to `t` — used to draw the travelled portion. */
export function slicePath(points: Coordinates[], t: number): Coordinates[] {
  if (t <= 0) return [points[0]];
  if (t >= 1) return [...points];

  const distances = cumulativeDistances(points);
  const { position, segmentIndex } = pointAlongPath(points, t, distances);
  return [...points.slice(0, segmentIndex + 1), position];
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function boundsOf(points: Coordinates[], paddingRatio = 0.16): Bounds {
  if (points.length === 0) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  // Guard against a zero-size box when every point coincides.
  const latSpan = Math.max(maxLat - minLat, 0.004);
  const lngSpan = Math.max(maxLng - minLng, 0.004);
  const latPad = latSpan * paddingRatio;
  const lngPad = lngSpan * paddingRatio;

  return {
    minLat: minLat - latPad,
    maxLat: minLat + latSpan + latPad,
    minLng: minLng - lngPad,
    maxLng: minLng + lngSpan + lngPad,
  };
}

/**
 * Expand `bounds` so its on-screen shape matches the target aspect ratio
 * (width / height), keeping the centre fixed.
 *
 * Without this, projecting into a fixed viewBox stretches the map
 * non-uniformly and cropping can push markers off screen. Longitude degrees
 * are narrower than latitude degrees away from the equator, so the comparison
 * is done in metres, not raw degrees.
 */
export function fitBoundsToAspect(bounds: Bounds, targetAspect: number): Bounds {
  if (!Number.isFinite(targetAspect) || targetAspect <= 0) return bounds;

  const centreLat = (bounds.minLat + bounds.maxLat) / 2;
  const centreLng = (bounds.minLng + bounds.maxLng) / 2;

  const latSpan = bounds.maxLat - bounds.minLat;
  const lngSpan = bounds.maxLng - bounds.minLng;

  // Metres-per-degree correction for longitude at this latitude.
  const lngScale = Math.max(0.05, Math.cos(toRadians(centreLat)));

  const widthMetres = lngSpan * lngScale;
  const heightMetres = latSpan;
  const currentAspect = widthMetres / heightMetres;

  let nextLatSpan = latSpan;
  let nextLngSpan = lngSpan;

  if (currentAspect < targetAspect) {
    // Too tall for the container — widen.
    nextLngSpan = (heightMetres * targetAspect) / lngScale;
  } else {
    // Too wide — heighten.
    nextLatSpan = widthMetres / targetAspect;
  }

  return {
    minLat: centreLat - nextLatSpan / 2,
    maxLat: centreLat + nextLatSpan / 2,
    minLng: centreLng - nextLngSpan / 2,
    maxLng: centreLng + nextLngSpan / 2,
  };
}

/** Project geographic coordinates into an SVG viewBox. */
export function project(
  point: Coordinates,
  bounds: Bounds,
  width: number,
  height: number,
): { x: number; y: number } {
  const x =
    ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
  // Latitude increases northwards; SVG y increases downwards.
  const y =
    height -
    ((point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
  return { x, y };
}

/** Catmull-Rom → cubic Bézier, for a route line without visible corners. */
export function toSmoothSvgPath(
  points: { x: number; y: number }[],
  tension = 0.5,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;

    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

/** Offset a coordinate by metres — used to scatter nearby driver markers. */
export function offsetCoordinates(
  origin: Coordinates,
  metresNorth: number,
  metresEast: number,
): Coordinates {
  const latPerMetre = 1 / 111_320;
  const lngPerMetre = 1 / (111_320 * Math.cos(toRadians(origin.lat)));
  return {
    lat: origin.lat + metresNorth * latPerMetre,
    lng: origin.lng + metresEast * lngPerMetre,
  };
}
