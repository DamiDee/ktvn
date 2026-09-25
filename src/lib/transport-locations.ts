export interface Coordinates { lat: number; lng: number }

export const CHIDA = {
  id: "k-rides-chida-utako", name: "Chida Event Centre",
  displayName: "Chida Event Centre, Utako, Abuja · community-supplied location",
  lat: 9.07081, lng: 7.43461,
};

export function knownPlaces(query: string) {
  return /\bchida\b/i.test(query) ? [CHIDA] : [];
}

export function validCoordinates(point: Coordinates) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

export function routingCoordinates(points: Coordinates[]) {
  if (points.length < 2 || points.length > 25 || points.some((p) => !validCoordinates(p))) throw new Error("Choose valid route locations.");
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}
