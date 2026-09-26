import { createAbujaCityLoader } from "@/lib/abuja-cities";

const loadCities = createAbujaCityLoader(process.env.GEONAMES_USERNAME ?? "", (url) => fetch(url, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(8_000),
  // Cache only validated catalogues in the loader, never a provider's HTTP-200 error.
  cache: "no-store",
}));

/** A fixed FCT-only lookup: no member address, typed text or coordinates leave the app. */
export async function GET() {
  const data = await loadCities();
  return Response.json(data, { headers: { "Cache-Control": data.providerComplete ? "public, max-age=3600, stale-while-revalidate=86400" : "public, max-age=300" } });
}
