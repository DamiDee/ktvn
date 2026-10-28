import type { Place, PlaceSuggestion } from "../domain/types";
import type { MapProvider } from "./map-provider";

export async function resolvePlaceSelection(provider: MapProvider, suggestion: PlaceSuggestion, signal?: AbortSignal): Promise<Place> {
  signal?.throwIfAborted();
  if (suggestion.point) return { ...suggestion, point: suggestion.point };
  if (!provider.resolvePlace) throw new Error("This location could not be confirmed. Choose another result or use the map.");
  const place = await provider.resolvePlace(suggestion, signal);
  signal?.throwIfAborted();
  return place;
}
