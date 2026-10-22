import test from "node:test";
import assert from "node:assert/strict";
import { parseOsrmRoute } from "../src/lib/road-routing.ts";
const response = () => ({ code: "Ok", routes: [{ geometry: { type: "LineString", coordinates: [[7.47, 9.06], [7.45, 9.07]] }, distance: 4100.6, duration: 420.3 }] });
test("OSRM response preserves road shape, coordinate order and rounded metrics", () => {
  assert.deepEqual(parseOsrmRoute(response()), { points: [{ lat: 9.06, lng: 7.47 }, { lat: 9.07, lng: 7.45 }], distanceMeters: 4101, durationSeconds: 420 });
});
test("unroutable or malformed responses cannot be shown as road geometry", () => {
  for (const bad of [null, { code: "NoRoute", routes: [] }, { code: "Ok", routes: [{}] }]) assert.throws(() => parseOsrmRoute(bad));
  for (const coordinates of [[], [[7, 9]], [[181, 9], [7, 9]], [[7, NaN], [7, 9]], [["7", 9], [7, 9]]]) {
    const data = response(); data.routes[0].geometry.coordinates = coordinates;
    assert.throws(() => parseOsrmRoute(data));
  }
  for (const metric of [NaN, Infinity, -1, "420"]) {
    const data = response(); data.routes[0].distance = metric;
    assert.throws(() => parseOsrmRoute(data));
  }
});
