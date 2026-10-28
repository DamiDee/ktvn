import { buildRoute } from "@/lib/geo";
import type { GeoPoint, RouteGeometry } from "../domain/types";

/** Urban average used only for the approximate fallback, in m/s (~24 km/h). */
const FALLBACK_SPEED_MPS = 6.7;

export function approximateRoute(points: GeoPoint[]): RouteGeometry {
  const origin = points[0];
  const destination = points[points.length - 1];
  const path = buildRoute(origin, destination, { seed: `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`, curvature: 0.06 });
  const distanceMeters = Math.round(path.distanceKm * 1000);
  return { points: path.points, distanceMeters, durationSeconds: Math.round(distanceMeters / FALLBACK_SPEED_MPS), source: "approximate" };
}

