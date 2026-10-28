import type { Coordinates } from "./transport-locations.ts";

export class GoogleGeocodingConfigurationError extends Error {}
function apiKey(env: Record<string, string | undefined>) {
  const key = (env.GOOGLE_MAPS_SERVER_API_KEY || env.GOOGLE_MAPS_BROWSER_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  if (!key) throw new GoogleGeocodingConfigurationError("Google address lookup is not configured on this server.");
  return key;
}
export async function searchGooglePlaces(query: string, signal?: AbortSignal, env: Record<string, string | undefined> = process.env) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey(env), "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location" },
    body: JSON.stringify({ textQuery: query, languageCode: "en", regionCode: "NG", pageSize: 7, locationBias: { rectangle: { low: { latitude: 8.3, longitude: 6.6 }, high: { latitude: 9.5, longitude: 7.9 } } } }),
    signal: signal ?? AbortSignal.timeout(8_000), cache: "no-store",
  });
  if (!response.ok) throw new Error("Google place search is unavailable.");
  const data = await response.json() as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }> };
  return (data.places ?? []).flatMap((place) => place.location && Number.isFinite(place.location.latitude) && Number.isFinite(place.location.longitude) ? [{ id: `google:${place.id}`, name: place.displayName?.text ?? place.formattedAddress ?? "Place", secondary: place.formattedAddress ?? "", lat: place.location.latitude, lng: place.location.longitude }] : []);
}
export async function reverseGooglePlace(point: Coordinates, env: Record<string, string | undefined> = process.env) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${point.lat},${point.lng}`); url.searchParams.set("region", "ng"); url.searchParams.set("key", apiKey(env));
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
  if (!response.ok) throw new Error("Google address lookup is unavailable.");
  const data = await response.json() as { status: string; results?: Array<{ place_id: string; formatted_address?: string; address_components?: Array<{ long_name: string }> }> };
  if (!["OK", "ZERO_RESULTS"].includes(data.status)) throw new Error("Google address lookup is unavailable.");
  const place = data.results?.[0];
  return { id: place ? `google:${place.place_id}` : `pin:${point.lat},${point.lng}`, name: place?.address_components?.[0]?.long_name ?? "Pinned location", secondary: place?.formatted_address ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, ...point };
}
