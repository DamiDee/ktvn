import type { Place } from "../paid-rides/domain/types";
export function rentalPickupText(place: Place): string {
  const { lat, lng } = place.point;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Choose a valid pickup on the map.");
  return `${[place.name, place.secondary].filter(Boolean).join(", ")}\nCoordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
export function rentalPickupPlace(text?: string): Place | null {
  const match = text?.match(/^([\s\S]+)\nCoordinates: (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[2]), lng = Number(match[3]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id: `rental-${lat},${lng}`, name: match[1], secondary: "", point: { lat, lng }, source: "saved" };
}

/** Coordinates stay in storage for map editing, not in the address label. */
export function rentalPickupLabel(text: string): string {
  return text.replace(/\s*Coordinates:\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/, "").trim();
}
