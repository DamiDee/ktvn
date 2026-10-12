/**
 * Shared Nominatim helpers for the Paid Rides geo proxies.
 *
 * Requests go through the server so the app sends an identifying User-Agent
 * (required by the Nominatim usage policy), responses can be cached, and no
 * provider detail leaks into the browser. Only the coordinates or text the
 * rider is searching for are forwarded — never their identity.
 */

export const NOMINATIM_BASE = (process.env.GEOCODING_API_BASE_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");

export const NOMINATIM_HEADERS = {
  "User-Agent": "K-Rides/1.0 (https://k-rides.app; paid rides)",
  Accept: "application/json",
  "Accept-Language": "en",
};

export interface NominatimItem {
  place_id: number | string;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

export interface PlaceResponse {
  id: string;
  name: string;
  secondary: string;
  lat: number;
  lng: number;
}

const PRIMARY_KEYS = ["amenity", "shop", "tourism", "building", "office", "leisure", "road", "neighbourhood", "suburb"];

/** Split a Nominatim result into a short primary line and its context. */
export function toPlace(item: NominatimItem): PlaceResponse {
  const parts = item.display_name.split(",").map((part) => part.trim()).filter(Boolean);
  const fromAddress = PRIMARY_KEYS.map((key) => item.address?.[key]).find(Boolean);
  const name = item.name?.trim() || fromAddress || parts[0] || "Pinned location";
  const secondary = parts
    .filter((part) => part !== name)
    .filter((part) => !/^\d{5,6}$/.test(part) && part !== "Nigeria")
    .slice(0, 3)
    .join(", ");
  return { id: String(item.place_id), name, secondary, lat: Number.parseFloat(item.lat), lng: Number.parseFloat(item.lon) };
}

export function parseCoordinate(value: string | null, limit: number): number | null {
  if (value === null) return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}
