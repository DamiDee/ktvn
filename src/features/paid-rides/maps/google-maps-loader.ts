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

let configuration: Promise<void> | undefined;
async function configure(): Promise<void> {
  if (configured) return;
  if (!configuration) configuration = (async () => {
    // Runtime config fixes deployments whose browser bundle was built before
    // the hosting key was configured. It exposes only a public browser key.
    let key = GOOGLE_MAPS_API_KEY;
    try {
      const response = await fetch("/api/maps/config", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (response.ok) {
        const data = await response.json() as { apiKey?: unknown };
        if (typeof data.apiKey === "string") key = data.apiKey.trim();
      }
    } catch { /* A configured build-time browser key remains usable. */ }
    if (!key) throw new Error("Google Maps is not configured on this deployment. Set GOOGLE_MAPS_BROWSER_API_KEY on the hosting server and restart the app.");
    const host = window as Window & { gm_authFailure?: () => void };
    const previous = host.gm_authFailure;
    host.gm_authFailure = () => {
      authFailed = true;
      failureListeners.forEach((listener) => listener());
      previous?.();
    };
    setOptions({ key, v: "weekly", language: "en", region: "NG" });
    configured = true;
  })().catch((error) => { configuration = undefined; throw error; });
  await configuration;
}

export async function loadGoogleLibrary<T extends keyof google.maps.ImportLibraryMap>(name: T): Promise<google.maps.ImportLibraryMap[T]> {
  if (authFailed) throw new Error("Google Maps access is unavailable. Please contact support.");
  await configure();
  return importLibrary(name);
}
