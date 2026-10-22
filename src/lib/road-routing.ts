/** Validate the OSRM response before it can be presented as a road route. */
export function parseOsrmRoute(value: unknown) {
  const data = value as { code?: unknown; routes?: Array<{ geometry?: { type?: unknown; coordinates?: unknown }; distance?: unknown; duration?: unknown }> } | null;
  const route = Array.isArray(data?.routes) ? data.routes[0] : undefined;
  const coordinates = route?.geometry?.coordinates;
  if (data?.code !== "Ok" || route?.geometry?.type !== "LineString" || !Array.isArray(coordinates) || coordinates.length < 2 ||
    typeof route.distance !== "number" || !Number.isFinite(route.distance) || route.distance < 0 ||
    typeof route.duration !== "number" || !Number.isFinite(route.duration) || route.duration < 0) throw new Error("Invalid road route");
  const points = coordinates.map((pair: unknown) => {
    if (!Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== "number" || typeof pair[1] !== "number" ||
      !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[0]) > 180 || Math.abs(pair[1]) > 90) throw new Error("Invalid route coordinate");
    return { lat: pair[1], lng: pair[0] };
  });
  return { points, distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration) };
}
