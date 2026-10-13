/**
 * Base-map tile sources shared by every Leaflet map in the app.
 *
 * The light basemap is CARTO "Positron": white and pale-grey land with light
 * grey roads and the street labels kept. It is built from OpenStreetMap data,
 * so both credits are required in the attribution.
 */
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();

export const LIGHT_TILE_URL = CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png";
export const LIGHT_TILE_SUBDOMAINS = "abcd";
export const LIGHT_TILE_ATTRIBUTION =
  "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors © <a href=\"https://carto.com/attributions\">CARTO</a>";

/** The stock OpenStreetMap tiles, kept for the dark theme where they are inverted by CSS. */
export const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_TILE_ATTRIBUTION = "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>";
