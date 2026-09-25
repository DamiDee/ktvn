/**
 * GET /api/geocode?q=<query>
 *
 * Proxies the query to Nominatim (OpenStreetMap geocoding) with a proper
 * User-Agent so the app complies with the Nominatim usage policy, and to
 * avoid any CORS friction in the browser.
 *
 * Nigeria (countrycodes=ng) is prioritised but global results are included
 * as a fallback so venues near the border are still found.
 */
import { knownPlaces } from "@/lib/transport-locations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const known = knownPlaces(q);
  if (known.length) return Response.json(known);
  if (!q || q.length < 2) {
    return Response.json([]);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  // Boost Nigerian results but don't exclude international ones entirely
  url.searchParams.set("countrycodes", "ng");
  url.searchParams.set("accept-language", "en");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "K-Rides/1.0 (https://k-rides.app; admin map picker)",
        Accept: "application/json",
      },
      // Nominatim asks for at most 1 req/s — Next.js server handles serialisation
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      return Response.json([], { status: res.status });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();

    const results = data.map((item) => ({
      id: item.place_id as string,
      name: (item.namedetails?.name ?? item.name ?? item.display_name.split(",")[0]) as string,
      displayName: item.display_name as string,
      lat: parseFloat(item.lat as string),
      lng: parseFloat(item.lon as string),
    }));

    return Response.json(results, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json([], { status: 502 });
  }
}
