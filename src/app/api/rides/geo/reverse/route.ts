import { guardGoogleRequest } from "@/lib/google-request-guard";
import { reverseGooglePlace, GoogleGeocodingConfigurationError } from "@/lib/google-geocoding";
import { validCoordinates } from "@/lib/transport-locations";
export async function GET(request: Request) {
  const limited = guardGoogleRequest(request); if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat"), lng = params.get("lng");
  const point = { lat: Number(lat), lng: Number(lng) };
  if (!lat?.trim() || !lng?.trim() || !validCoordinates(point)) return Response.json({ message: "Provide a valid coordinate." }, { status: 400 });
  try { return Response.json(await reverseGooglePlace(point), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ message: error instanceof GoogleGeocodingConfigurationError ? error.message : "Google address lookup is unavailable." }, { status: error instanceof GoogleGeocodingConfigurationError ? 503 : 502 }); }
}
