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
    const base = (process.env.ROUTING_API_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
    const response = await fetch(`${base}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const route = data.routes?.[0];
    const line: unknown = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !route || !Array.isArray(line) || line.length < 2) throw new Error();
    return Response.json({
      points: (line as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
    });
  } catch {
    return Response.json({ message: "Road routing is unavailable." }, { status: 502 });
  }
}
