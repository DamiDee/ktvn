import { guardGoogleRequest } from "@/lib/google-request-guard";
import { fetchGoogleRoadRoute, GoogleRoutingConfigurationError } from "@/lib/google-routes";
import { validCoordinates, type Coordinates } from "@/lib/transport-locations";
export async function GET(request: Request) {
  const limited = guardGoogleRequest(request); if (limited) return limited;
  let points: Coordinates[];
  try {
    points = JSON.parse(new URL(request.url).searchParams.get("points") ?? "null");
    if (!Array.isArray(points) || points.length < 2 || points.length > 25 || points.some((point) => !point || !validCoordinates(point))) throw new Error();
  } catch { return Response.json({ message: "Provide 2–25 valid coordinates." }, { status: 400 }); }
  try { return Response.json({ ...await fetchGoogleRoadRoute(points), source: "road", provider: "google" }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof GoogleRoutingConfigurationError ? error.message : "Google road routing is unavailable." }, { status: error instanceof GoogleRoutingConfigurationError ? 503 : 502 }); }
}
