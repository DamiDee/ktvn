import assert from "node:assert/strict";
import test from "node:test";
import { mapTileSource, OSM_TILE_URL, OSM_TILE_ATTRIBUTION } from "../src/lib/map-tiles.ts";

test("keyless deployments use OpenStreetMap in both themes", () => {
  for (const dark of [false, true]) {
    const source = mapTileSource({ dark, cartoApiKey: "" });
    assert.equal(source.url, "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    assert.equal(source.attribution, OSM_TILE_ATTRIBUTION);
    assert.equal(source.provider, "osm");
    assert.equal(source.url.includes("cartocdn"), false);
  }
});

test("a configured CARTO key enables Positron with matching attribution", () => {
  const source = mapTileSource({ cartoApiKey: " test-key " });
  assert.equal(source.url, "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=test-key");
  assert.equal(source.provider, "carto");
  assert.ok(source.attribution.includes("CARTO"));
  assert.ok(source.attribution.includes("OpenStreetMap"));
  assert.equal(source.subdomains, "abcd");
  assert.equal(mapTileSource({ dark: true, cartoApiKey: "test-key" }).url, OSM_TILE_URL);
});

test("custom CARTO URLs cannot bypass the missing-key fallback", () => {
  for (const customUrl of [
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
    "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=",
  ]) {
    assert.equal(mapTileSource({ customUrl, cartoApiKey: "" }).url, OSM_TILE_URL);
  }
});

test("custom CARTO URLs receive the configured key without damaging their template", () => {
  const customUrl = "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?language=en#tiles";
  const source = mapTileSource({ customUrl, cartoApiKey: "test+key&value" });
  assert.equal(source.url, "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?language=en&key=test%2Bkey%26value#tiles");
  assert.equal(source.provider, "carto");
  const emptyKey = "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=";
  assert.equal(mapTileSource({ customUrl: emptyKey, cartoApiKey: "test-key" }).url, `${emptyKey}test-key`);
});

test("explicit provider URLs and existing CARTO keys are preserved", () => {
  const cartoUrl = "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=existing-test-key";
  assert.equal(mapTileSource({ customUrl: cartoUrl, cartoApiKey: "" }).url, cartoUrl);
  const custom = "https://tiles.example.test/{z}/{x}/{y}.png";
  assert.equal(mapTileSource({ customUrl: ` ${custom} `, cartoApiKey: "" }).url, custom);
  assert.equal(mapTileSource({ customUrl: custom, cartoApiKey: "" }).provider, "custom");
});
