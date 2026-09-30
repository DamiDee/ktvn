/** A device-only preference, never an API reservation or a transport guarantee. */
const key = (userId: string, bookingId: string) => `kr-return-preference:v1:${userId}:${bookingId}`;
export function readReturnPreference(userId: string, bookingId: string) {
  try { return typeof window !== "undefined" && window.localStorage.getItem(key(userId, bookingId)) === "yes"; } catch { return false; }
}
export function saveReturnPreference(userId: string, bookingId: string, requested: boolean) {
  try { if (requested) window.localStorage.setItem(key(userId, bookingId), "yes"); else window.localStorage.removeItem(key(userId, bookingId)); return true; } catch { return false; }
}
