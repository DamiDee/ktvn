import { knownPlaces } from "@/lib/transport-locations";
import { NOMINATIM_BASE, NOMINATIM_HEADERS, parseCoordinate, toPlace, type NominatimItem } from "../nominatim";

/**
 * GET /api/rides/geo/search?q=&lat=&lng=
 *
 * Place search for Paid Rides. Biased towards the rider's area when a point
 * is supplied (results elsewhere still appear), limited to Nigeria.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return Response.json([]);

  const known = knownPlaces(q).map((place) => ({ id: `known-${place.lat},${place.lng}`, name: "Chida Event Centre", secondary: "Utako, Abuja", lat: place.lat, lng: place.lng }));

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "7");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "ng");

  const lat = parseCoordinate(params.get("lat"), 90);
  const lng = parseCoordinate(params.get("lng"), 180);
  if (lat !== null && lng !== null) {
    // ~25 km box around the rider, used as a preference, not a filter.
    const d = 0.22;
    url.searchParams.set("viewbox", `${lng - d},${lat + d},${lng + d},${lat - d}`);
    url.searchParams.set("bounded", "0");
  }

  try {
    const response = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 300 } });
    if (!response.ok) return Response.json({ message: "Place search is unavailable." }, { status: 502 });
    const items = (await response.json()) as NominatimItem[];
    const places = items.map(toPlace).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
    return Response.json([...known, ...places.filter((place) => !known.some((k) => k.name === place.name))], {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch {
    return Response.json({ message: "Place search is unavailable." }, { status: 502 });
  }
}
