/**
 * Base-map tile sources shared by every Leaflet map in the app.
 *
 * CARTO Positron requires a key. Builds without one use OpenStreetMap instead
 * of requesting CARTO's watermarked placeholder images.
 */
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();

const CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png";
const CARTO_TILE_ATTRIBUTION =
  "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors © <a href=\"https://carto.com/attributions\">CARTO</a>";

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_TILE_ATTRIBUTION = "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";

export function mapTileSource(options: { dark?: boolean; customUrl?: string; cartoApiKey?: string } = {}) {
  const key = (options.cartoApiKey ?? CARTO_API_KEY)?.trim();
  const custom = options.customUrl?.trim();
  let url = custom || (!options.dark && key ? CARTO_TILE_URL : OSM_TILE_URL);
  const carto = /^https:\/\/(?:\{s\}\.|[a-d]\.)?basemaps\.cartocdn\.com\//i.test(url);
  if (carto) {
    const embeddedKey = /[?&]key=([^&#]+)/.test(url);
    if (!embeddedKey && !key) return { url: OSM_TILE_URL, attribution: OSM_TILE_ATTRIBUTION, subdomains: "abc", provider: "osm" as const };
    if (!embeddedKey) {
      const [base, hash] = url.split("#", 2);
      const authenticated = /[?&]key=/.test(base)
        ? base.replace(/([?&])key=[^&#]*/g, `$1key=${encodeURIComponent(key!)}`)
        : `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key!)}`;
      url = `${authenticated}${hash ? `#${hash}` : ""}`;
    }
    return { url, attribution: CARTO_TILE_ATTRIBUTION, subdomains: "abcd", provider: "carto" as const };
  }
  return { url, attribution: OSM_TILE_ATTRIBUTION, subdomains: "abc", provider: url === OSM_TILE_URL ? "osm" as const : "custom" as const };
}

const light = mapTileSource();
export const LIGHT_TILE_URL = light.url;
export const LIGHT_TILE_SUBDOMAINS = light.subdomains;
export const LIGHT_TILE_ATTRIBUTION = light.attribution;
