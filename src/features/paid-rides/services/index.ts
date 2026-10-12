import { PAID_RIDES_MODE } from "../config";
import { osmMapProvider } from "../maps/osm-map-provider";
import type { MapProvider } from "../maps/map-provider";
import { createApiRideService } from "./ride-api-service";
import { createMockRideService } from "./ride-mock-service";
import type { RideService } from "./ride-service";

/**
 * The single switch between the real backend and the simulation. Nothing
 * else in Paid Rides checks the mode to decide where data comes from.
 */

let service: RideService | null = null;

export function getRideService(): RideService {
  service ??= PAID_RIDES_MODE === "api" ? createApiRideService() : createMockRideService();
  return service;
}

export function getMapProvider(): MapProvider {
  return osmMapProvider;
}

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export type { RideService } from "./ride-service";
