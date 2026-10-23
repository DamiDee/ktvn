import { fetchRoadRoute, RoutingConfigurationError } from "@/lib/osrm-client";
import { routingCoordinates, type Coordinates } from "@/lib/transport-locations";

/**
 * GET /api/rides/geo/route?points=[{lat,lng},…]
 *
 * Road route with geometry from the configured OSRM service (the same
 * `ROUTING_API_BASE_URL` Free Buses uses). Never falls back to a straight
 * line here — the client labels its own fallback as approximate.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("points");
  let coordinates: string;
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    if (!Array.isArray(parsed) || parsed.some((p) => !p || typeof p.lat !== "number" || typeof p.lng !== "number")) throw new Error();
    coordinates = routingCoordinates(parsed as Coordinates[]);
  } catch {
    return Response.json({ message: "Provide 2–25 valid coordinates." }, { status: 400 });
  }

  try {
    return Response.json(await fetchRoadRoute(coordinates));
  } catch (error) {
    if (error instanceof RoutingConfigurationError) return Response.json({ message: error.message }, { status: 503 });
    return Response.json({ message: "Road routing is unavailable." }, { status: 502 });
  }
}
