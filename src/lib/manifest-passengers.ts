import type { ApiBooking } from "../types/freebus-api";

export interface ManifestPassenger { id: string; name: string }

/** Look up only passengers in the selected bus's visible manifest. */
export function manifestPassengerIds(bookings: ApiBooking[], busId: string) {
  if (!busId) return [];
  return [...new Set(bookings.filter((booking) => booking.bus_id === busId && booking.user_id).map((booking) => booking.user_id))];
}

/** Retain names only; the existing profile endpoint also returns account details. */
export async function loadManifestPassenger(
  read: (path: string, options?: RequestInit) => Promise<unknown>,
  userId: string,
  signal?: AbortSignal,
): Promise<ManifestPassenger> {
  const value = await read(`users/${encodeURIComponent(userId)}`, { signal });
  if (!value || typeof value !== "object" || !("id" in value) || value.id !== userId ||
    !("first_name" in value) || typeof value.first_name !== "string" ||
    !("last_name" in value) || typeof value.last_name !== "string") {
    throw new Error("The service did not return this passenger's name.");
  }
  const name = `${value.first_name} ${value.last_name}`.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("This passenger's name is unavailable.");
  return { id: userId, name };
}
