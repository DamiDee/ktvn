import { NOMINATIM_BASE, NOMINATIM_HEADERS, parseCoordinate, toPlace, type NominatimItem } from "../nominatim";

/** GET /api/rides/geo/reverse?lat=&lng= — the address under a map pin. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = parseCoordinate(params.get("lat"), 90);
  const lng = parseCoordinate(params.get("lng"), 180);
  if (lat === null || lng === null) return Response.json({ message: "Provide a valid coordinate." }, { status: 400 });

  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  // Rounded to ~11 m: precise enough for a pickup, and cache-friendly.
  url.searchParams.set("lat", lat.toFixed(4));
  url.searchParams.set("lon", lng.toFixed(4));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!response.ok) return Response.json({ message: "Address lookup is unavailable." }, { status: 502 });
    const item = (await response.json()) as NominatimItem & { error?: string };
    if (item.error) return Response.json({ message: "No address here." }, { status: 404 });
    // Keep the rider's exact point; the address is only a label for it.
    return Response.json({ ...toPlace(item), lat, lng });
  } catch {
    return Response.json({ message: "Address lookup is unavailable." }, { status: 502 });
  }
}
