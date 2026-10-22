import { parseOsrmRoute } from "@/lib/road-routing";
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
    const configured = process.env.ROUTING_API_BASE_URL?.trim();
    // The public OSRM demo is limited to non-commercial testing. Paid rides
    // need their own routing service; never silently use the demo in production.
    const base = (configured || (process.env.NODE_ENV === "production" ? "" : "https://router.project-osrm.org")).replace(/\/$/, "");
    if (!base || process.env.NODE_ENV === "production" && new URL(base).hostname === "router.project-osrm.org") {
      return Response.json({ message: "A production road-routing server must be configured." }, { status: 503 });
    }
    const response = await fetch(`${base}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error();
    return Response.json(parseOsrmRoute(await response.json()));
  } catch {
    return Response.json({ message: "Road routing is unavailable." }, { status: 502 });
  }
}
