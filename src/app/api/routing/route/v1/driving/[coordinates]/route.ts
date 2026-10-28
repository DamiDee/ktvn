import { guardGoogleRequest } from "@/lib/google-request-guard";
import { fetchGoogleRoadRoute, GoogleRoutingConfigurationError } from "@/lib/google-routes";
import { validCoordinates } from "@/lib/transport-locations";

/** Google routing in the existing backend's OSRM route-response shape. */
export async function GET(request: Request, { params }: { params: Promise<{ coordinates: string }> }) {
  const limited = guardGoogleRequest(request); if (limited) return limited;
  const query = new URL(request.url).searchParams;
  // This compatibility endpoint supplies route geometry/metrics, not OSRM's
  // turn instructions, matching, table, or alternative-route services.
  if (query.get("steps") === "true" || query.get("alternatives") === "true") return Response.json({ code: "InvalidQuery", message: "Only driving route geometry and metrics are supported." }, { status: 400 });
  const geometry = query.get("geometries") ?? "geojson";
  if (geometry !== "geojson") return Response.json({ code: "InvalidQuery", message: "Request geometries=geojson for Google route compatibility." }, { status: 400 });
  const points = (await params).coordinates.split(";").map((pair) => {
    const parts = pair.split(",");
    return parts.length === 2 && parts.every((part) => part.trim()) ? { lng: Number(parts[0]), lat: Number(parts[1]) } : { lat: NaN, lng: NaN };
  });
  if (points.length < 2 || points.length > 25 || points.some((point) => !validCoordinates(point))) return Response.json({ code: "InvalidQuery", message: "Provide 2–25 valid longitude,latitude pairs." }, { status: 400 });
  try {
    const route = await fetchGoogleRoadRoute(points);
    return Response.json({ code: "Ok", provider: "google", routes: [{ distance: route.distanceMeters, duration: route.durationSeconds, ...(query.get("overview") === "false" ? {} : { geometry: { type: "LineString", coordinates: route.points.map((point) => [point.lng, point.lat]) } }) }] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ code: "NoRoute", message: error instanceof GoogleRoutingConfigurationError ? error.message : "Google routing is unavailable." }, { status: error instanceof GoogleRoutingConfigurationError ? 503 : 502 }); }
}
