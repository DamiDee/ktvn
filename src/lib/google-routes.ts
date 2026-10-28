import { validCoordinates, type Coordinates } from "./transport-locations.ts";

export class GoogleRoutingConfigurationError extends Error {}
export interface GoogleRoadRoute { points: Coordinates[]; distanceMeters: number; durationSeconds: number }

export function parseGoogleRoadRoute(value: unknown): GoogleRoadRoute {
  const body = value as { routes?: Array<{ distanceMeters?: unknown; duration?: unknown; polyline?: { geoJsonLinestring?: { type?: unknown; coordinates?: unknown } } }> } | null;
  const route = body?.routes?.[0];
  const geometry = route?.polyline?.geoJsonLinestring;
  const duration = typeof route?.duration === "string" ? /^(\d+(?:\.\d+)?)s$/.exec(route.duration) : null;
  if (!route || !geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2 || typeof route.distanceMeters !== "number" || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0 || !duration || !Number.isFinite(Number(duration[1]))) throw new Error("Google did not return a usable road route.");
  const points = geometry.coordinates.map((pair: unknown) => {
    if (!Array.isArray(pair) || typeof pair[0] !== "number" || typeof pair[1] !== "number") throw new Error("Invalid Google route geometry.");
    const point = { lat: pair[1], lng: pair[0] };
    if (!validCoordinates(point)) throw new Error("Invalid Google route coordinate.");
    return point;
  });
  return { points, distanceMeters: Math.round(route.distanceMeters), durationSeconds: Math.round(Number(duration[1])) };
}

/** The server key stays in request headers and is never returned to browsers. */
export async function fetchGoogleRoadRoute(points: Coordinates[], env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<GoogleRoadRoute> {
  if (points.length < 2 || points.length > 25 || points.some((point) => !validCoordinates(point))) throw new Error("Provide 2–25 valid coordinates.");
  const key = (env.GOOGLE_MAPS_SERVER_API_KEY || env.GOOGLE_MAPS_BROWSER_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  if (!key) throw new GoogleRoutingConfigurationError("Google routing is not configured on this server.");
  const location = (point: Coordinates) => ({ location: { latLng: { latitude: point.lat, longitude: point.lng } } });
  const response = await fetcher("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring" },
    body: JSON.stringify({ origin: location(points[0]), destination: location(points.at(-1)!), intermediates: points.slice(1, -1).map(location), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", polylineEncoding: "GEO_JSON_LINESTRING", polylineQuality: "HIGH_QUALITY", languageCode: "en", regionCode: "NG" }),
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!response.ok) throw new Error("Google road routing is unavailable.");
  return parseGoogleRoadRoute(await response.json());
}
