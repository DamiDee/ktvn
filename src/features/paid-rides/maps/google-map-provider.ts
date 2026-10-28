import type { GeoPoint, Place, PlaceSuggestion } from "../domain/types";
import type { MapProvider } from "./map-provider";
import { loadGoogleLibrary } from "./google-maps-loader";

let session: google.maps.places.AutocompleteSessionToken | undefined;
let sessionStarted = 0;
const predictions = new Map<string, google.maps.places.PlacePrediction>();

export const googleMapProvider: MapProvider = {
  name: "Google Maps",
  attribution: "Google Maps",
  async searchPlaces(query, { near, signal }) {
    signal?.throwIfAborted();
    const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadGoogleLibrary("places");
    signal?.throwIfAborted();
    if (!session || Date.now() - sessionStarted > 180_000) {
      session = new AutocompleteSessionToken(); sessionStarted = Date.now(); predictions.clear();
    }
    const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query, sessionToken: session, includedRegionCodes: ["ng"], region: "ng", language: "en",
      // Bias, rather than restrict: include villages and landmarks across FCT.
      locationBias: near ? { center: near, radius: 50_000 } : { north: 9.5, south: 8.3, west: 6.6, east: 7.9 },
    });
    signal?.throwIfAborted();
    return result.suggestions.flatMap(({ placePrediction: prediction }): PlaceSuggestion[] => {
      if (!prediction) return [];
      const id = `google:${prediction.placeId}`;
      predictions.set(id, prediction);
      if (predictions.size > 100) predictions.delete(predictions.keys().next().value!);
      return [{ id, name: prediction.mainText?.text ?? prediction.text.text, secondary: prediction.secondaryText?.text ?? "", point: null, source: "search" }];
    });
  },
  async resolvePlace(suggestion, signal) {
    signal?.throwIfAborted();
    const { Place: GooglePlace } = await loadGoogleLibrary("places");
    const place = predictions.get(suggestion.id)?.toPlace() ?? new GooglePlace({ id: suggestion.id.replace(/^google:/, "") });
    try {
      await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location"] });
      signal?.throwIfAborted();
      if (!place.location) throw new Error("Google Maps did not return a location for this place. Choose it on the map.");
      return { id: `google:${place.id}`, name: place.displayName || suggestion.name, secondary: place.formattedAddress || suggestion.secondary, point: place.location.toJSON(), source: "search" };
    } finally { session = undefined; predictions.clear(); }
  },
  async reverseGeocode(point, signal) {
    signal?.throwIfAborted();
    const { Geocoder } = await loadGoogleLibrary("geocoding");
    const { results } = await new Geocoder().geocode({ location: point, region: "ng", fulfillOnZeroResults: true });
    signal?.throwIfAborted();
    const result = results[0];
    // Keep the user's exact pin, rather than snapping it to a nearby address.
    return { id: result ? `google:${result.place_id}` : `pin:${point.lat},${point.lng}`, name: result?.address_components[0]?.long_name ?? "Pinned location", secondary: result?.formatted_address ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, point, source: "map-pin" } satisfies Place;
  },
  async calculateRoute(points: GeoPoint[], signal) {
    signal?.throwIfAborted();
    if (points.length < 2 || points.length > 27) throw new Error("Choose between two and 27 route points.");
    const { Route } = await loadGoogleLibrary("routes");
    signal?.throwIfAborted();
    const { routes } = await Route.computeRoutes({ origin: points[0], destination: points.at(-1)!, intermediates: points.slice(1, -1).map((location) => ({ location })), travelMode: "DRIVING", fields: ["path", "distanceMeters", "durationMillis"] });
    signal?.throwIfAborted();
    const route = routes?.[0];
    if (!route?.path?.length || route.distanceMeters == null || route.durationMillis == null) throw new Error("Google Maps could not find a road route between these locations.");
    return { points: route.path.map((point) => ({ lat: point.lat, lng: point.lng })), distanceMeters: route.distanceMeters, durationSeconds: route.durationMillis / 1_000, source: "road" };
  },
};
