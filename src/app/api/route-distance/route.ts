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
    const base = (process.env.ROUTING_API_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
    const response = await fetch(`${base}/route/v1/driving/${coordinates}?overview=false&steps=false`, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const metres = data.routes?.[0]?.distance;
    if (data.code !== "Ok" || typeof metres !== "number" || !Number.isFinite(metres) || metres <= 0) throw new Error();
    return Response.json({ distance_km: Math.round(metres / 10) / 100, source: "Road-route estimate" });
  } catch { return Response.json({ message: "Road distance is unavailable. Retry or enter a verified distance manually." }, { status: 502 }); }
}
