import { parseOsrmRoute } from "./road-routing.ts";

type Environment = Record<string, string | undefined>;
type FetchRoute = (input: string, init: RequestInit & { next?: { revalidate: number } }) => Promise<Response>;
const demoHosts = new Set(["router.project-osrm.org", "routing.openstreetmap.de"]);

export class RoutingConfigurationError extends Error {}

function serviceUrl(value: string | undefined, production: boolean) {
  if (!value?.trim()) return undefined;
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new RoutingConfigurationError("Configure a valid OSRM service URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      production && demoHosts.has(url.hostname.toLowerCase().replace(/\.$/, ""))) {
    throw new RoutingConfigurationError("Configure an OSRM service approved for production use.");
  }
  return url.toString().replace(/\/$/, "");
}

/** One circuit per service, shared by map and distance requests in this process. */
export function createOsrmClient(fetchRoute: FetchRoute = fetch, now = Date.now) {
  const unavailableUntil = new Map<string, number>();
  return async function roadRoute(coordinates: string, env: Environment = process.env, revalidate = 600) {
    const production = env.NODE_ENV === "production";
    const primary = serviceUrl(env.ROUTING_API_BASE_URL || (!production ? "https://router.project-osrm.org" : undefined), production);
    if (!primary) throw new RoutingConfigurationError("A production road-routing server must be configured.");
    const backup = serviceUrl(env.ROUTING_FALLBACK_API_BASE_URL, production);
    const services = [...new Set([primary, ...(backup ? [backup] : [])])];
    for (const base of services) {
      if ((unavailableUntil.get(base) ?? 0) > now()) continue;
      try {
        const response = await fetchRoute(`${base}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
          signal: AbortSignal.timeout(3500),
          headers: { "User-Agent": "K-Rides/1.0 (https://app.freebus.cloud)" },
          next: { revalidate },
        });
        // A real coverage/no-route response must not widen FCT coverage via backup.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new NonRetryableRouteError("No road route is available for these locations.");
        }
        if (!response.ok) throw new Error("Routing service unavailable");
        const data = await response.json();
        if (data?.code === "NoRoute" || data?.code === "NoSegment") {
          throw new NonRetryableRouteError("No road route is available for these locations.");
        }
        const route = parseOsrmRoute(data);
        unavailableUntil.delete(base);
        return route;
      } catch (error) {
        if (error instanceof NonRetryableRouteError) throw error;
        // Avoid making every request wait for an unhealthy service during an outage.
        unavailableUntil.set(base, now() + 30_000);
      }
    }
    throw new Error("Road routing is unavailable.");
  };
}
class NonRetryableRouteError extends Error {}
export const fetchRoadRoute = createOsrmClient();
