import { buildRoute } from "@/lib/geo";
import { RideServiceError, errorCodeForStatus, toRideError } from "../domain/errors";
import type { GeoPoint, Place, RouteGeometry } from "../domain/types";
import type { MapProvider } from "./map-provider";

/**
 * OpenStreetMap-backed provider: Nominatim for places, OSRM for roads, both
 * through this app's own `/api/rides/geo/*` proxies so no third-party detail
 * or key reaches the browser.
 *
 * When the road router fails, `calculateRoute` returns a smoothed estimate
 * marked `source: "approximate"`, and the UI says so instead of presenting
 * it as a real road route.
 */

interface PlaceResponse {
  id: string;
  name: string;
  secondary: string;
  lat: number;
  lng: number;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    throw toRideError(error);
  }
  if (!response.ok) throw new RideServiceError(errorCodeForStatus(response.status), { status: response.status });
  return (await response.json()) as T;
}

function toPlace(item: PlaceResponse, source: Place["source"]): Place {
  return { id: item.id, name: item.name, secondary: item.secondary, point: { lat: item.lat, lng: item.lng }, source };
}

/** Urban average used only for the approximate fallback, in m/s (~24 km/h). */
const FALLBACK_SPEED_MPS = 6.7;

export function approximateRoute(points: GeoPoint[]): RouteGeometry {
  const origin = points[0];
  const destination = points[points.length - 1];
  const path = buildRoute(origin, destination, { seed: `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`, curvature: 0.06 });
  const distanceMeters = Math.round(path.distanceKm * 1000);
  return { points: path.points, distanceMeters, durationSeconds: Math.round(distanceMeters / FALLBACK_SPEED_MPS), source: "approximate" };
}

export const osmMapProvider: MapProvider = {
  name: "OpenStreetMap",
  attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",

  async searchPlaces(query, { near, signal } = {}) {
    const params = new URLSearchParams({ q: query });
    if (near) {
      params.set("lat", near.lat.toFixed(3));
      params.set("lng", near.lng.toFixed(3));
    }
    const items = await getJson<PlaceResponse[]>(`/api/rides/geo/search?${params}`, signal);
    return items.map((item) => toPlace(item, "search"));
  },

  async reverseGeocode(point, signal) {
    try {
      const item = await getJson<PlaceResponse>(`/api/rides/geo/reverse?lat=${point.lat}&lng=${point.lng}`, signal);
      return toPlace(item, "map-pin");
    } catch (error) {
      const rideError = toRideError(error);
      if (rideError.code === "timeout" && signal?.aborted) throw rideError;
      // A pin is still a valid pickup without a street name.
      return {
        id: `pin-${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
        name: "Pinned location",
        secondary: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        point,
        source: "map-pin",
      };
    }
  },

  async calculateRoute(points, signal) {
    try {
      const data = await getJson<Omit<RouteGeometry, "source">>(
        `/api/rides/geo/route?points=${encodeURIComponent(JSON.stringify(points.map((p) => ({ lat: p.lat, lng: p.lng }))))}`,
        signal,
      );
      return { ...data, source: "road" };
    } catch (error) {
      if (signal?.aborted) throw toRideError(error);
      return approximateRoute(points);
    }
  },
};
