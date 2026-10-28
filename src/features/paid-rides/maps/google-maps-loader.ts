import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { GOOGLE_MAPS_API_KEY } from "../config";

let configured = false;
let authFailed = false;
const failureListeners = new Set<() => void>();
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  failureListeners.add(listener);
  if (authFailed) listener();
  return () => { failureListeners.delete(listener); };
}

export function loadGoogleLibrary<T extends keyof google.maps.ImportLibraryMap>(name: T): Promise<google.maps.ImportLibraryMap[T]> {
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("Google Maps is not configured."));
  if (authFailed) return Promise.reject(new Error("Google Maps access is unavailable. Please contact support."));
  if (!configured) {
    const host = window as Window & { gm_authFailure?: () => void };
    const previous = host.gm_authFailure;
    host.gm_authFailure = () => {
      authFailed = true;
      failureListeners.forEach((listener) => listener());
      previous?.();
    };
    setOptions({ key: GOOGLE_MAPS_API_KEY, v: "weekly", language: "en", region: "NG" });
    configured = true;
  }
  return importLibrary(name);
}
