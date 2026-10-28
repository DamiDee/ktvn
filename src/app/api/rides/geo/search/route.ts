import { guardGoogleRequest } from "@/lib/google-request-guard";
import { searchGooglePlaces, GoogleGeocodingConfigurationError } from "@/lib/google-geocoding";
export async function GET(request: Request) {
  const limited = guardGoogleRequest(request); if (limited) return limited;
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (query.length < 2) return Response.json([]);
  try { return Response.json(await searchGooglePlaces(query), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof GoogleGeocodingConfigurationError ? error.message : "Google place search is unavailable." }, { status: error instanceof GoogleGeocodingConfigurationError ? 503 : 502 }); }
}
