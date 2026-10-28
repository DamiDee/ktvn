import type { GeoPoint, Place, PlaceSuggestion, RouteGeometry } from "../domain/types";

/**
 * Map data provider. Rendering lives separately in `RideMap`; this is the
 * data half (search, geocoding, routing), so the backend or a different
 * vendor can replace it without touching screens.
 */
export interface MapProvider {
  readonly name: string;
  /** Attribution required by the data/tile providers. */
  readonly attribution: string;
  searchPlaces(query: string, options: { near?: GeoPoint; signal?: AbortSignal }): Promise<PlaceSuggestion[]>;
  resolvePlace?(suggestion: PlaceSuggestion, signal?: AbortSignal): Promise<Place>;
  reverseGeocode(point: GeoPoint, signal?: AbortSignal): Promise<Place>;
  calculateRoute(points: GeoPoint[], signal?: AbortSignal): Promise<RouteGeometry>;
}

/**
 * The imperative surface a rendered ride map exposes. Screens describe what
 * to show (props); this handle covers the few camera actions they trigger.
 */
export interface RideMapHandle {
  fitRouteBounds(points: GeoPoint[], options?: { animate?: boolean }): void;
  recenter(): void;
  getCenter(): GeoPoint | null;
}
