import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const spec = JSON.parse(readFileSync(new URL("../public/openapi.json", import.meta.url), "utf8"));

test("trip and bus actions match the supplied API methods", () => {
  for (const [path, method] of [
    ["/trips", "post"], ["/trips", "get"], ["/trips/{trip_id}", "patch"], ["/trips/{trip_id}", "delete"],
    ["/trips/{trip_id}/start", "patch"], ["/trips/{trip_id}/complete", "patch"], ["/trips/{trip_id}/cancel", "patch"],
    ["/buses/{bus_id}/assign-trip", "post"], ["/buses/{bus_id}/trip", "patch"], ["/buses/reset-trips", "post"], ["/auth/refresh", "post"],
  ]) assert.ok(spec.paths[path]?.[method], `${method} ${path}`);
  for (const path of ["/buses/reset-routes", "/buses/{bus_id}/assign-route", "/routes/{route_id}/complete"]) assert.equal(spec.paths[path], undefined);
});
test("route is reusable; booking and bus assignment carry a trip identity", () => {
  const schemas = spec.components.schemas;
  for (const key of ["departure_date", "departure_time", "is_completed", "ride_type"]) assert.equal(schemas.Route.properties[key], undefined);
  assert.ok(schemas.Trip.properties.departure_time);
  assert.ok(schemas.Bus.properties.current_trip_id);
  assert.ok(schemas.CreateBookingDto.properties.trip_id);
  assert.ok(schemas.Booking.properties.trip_id);
  assert.deepEqual(schemas.CreateTripDto.required, ["route_id", "departure_time", "arrival_time", "ride_type"]);
  assert.equal(schemas.UpdateTripDto.properties.route_id, undefined);
});
