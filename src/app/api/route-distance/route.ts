import { fetchRoadRoute, RoutingConfigurationError } from "@/lib/osrm-client";
import { routingCoordinates, type Coordinates } from "@/lib/transport-locations";

/** Only public stop coordinates are sent to the configured road-routing service. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("points");
  let coordinates: string;
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    if (!Array.isArray(parsed) || parsed.some((p) => !p || typeof p.lat !== "number" || typeof p.lng !== "number")) throw new Error();
    coordinates = routingCoordinates(parsed as Coordinates[]);
  } catch { return Response.json({ message: "Provide 2–25 valid coordinates." }, { status: 400 }); }
  try {
    const route = await fetchRoadRoute(coordinates, process.env, 3600);
    const metres = route.distanceMeters;
    if (metres <= 0) throw new Error();
    return Response.json({ distance_km: Math.round(metres / 10) / 100, source: "Road-route estimate" });
  } catch (error) {
    if (error instanceof RoutingConfigurationError) return Response.json({ message: error.message }, { status: 503 });
    return Response.json({ message: "Road distance is unavailable. Retry or enter a verified distance manually." }, { status: 502 });
  }
}
