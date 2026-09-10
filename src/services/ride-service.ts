import { buildRoute } from "@/lib/geo";
import { ALL_LOCATIONS, searchLocations } from "@/mocks/locations";
import { DRIVERS } from "@/mocks/people";
import {
  DRIVER_EARNINGS,
  DRIVER_RECEIPTS,
  DRIVER_REQUESTS,
  DRIVER_TRIPS,
  findRide,
  PASSENGER_RIDES,
  PROFESSIONAL_REQUESTS,
  UPCOMING_EVENT,
} from "@/mocks/rides";
import { DriverTrack, RideType } from "@/types/enums";
import type {
  Driver,
  DriverEarning,
  Event,
  Receipt,
  Ride,
  RideLocation,
  RideRequest,
  RoutePath,
} from "@/types/models";
import { MockDelay, request, type RequestOptions } from "./api-client";

/** Fare model. Professional track only — never called for volunteer rides. */
const BASE_FARE = 400;
const FARE_PER_KM = 58;

export interface FareQuote {
  routeFare: number;
  /** Per-rider share at the given occupancy. */
  perRider: number;
  riders: number;
  breakdown: { riders: number; each: number }[];
}

export function quoteFare(distanceKm: number, riders = 1): FareQuote {
  const raw = BASE_FARE + distanceKm * FARE_PER_KM;
  // Round to the nearest ₦50 so quotes read cleanly.
  const routeFare = Math.round(raw / 50) * 50;
  const safeRiders = Math.min(3, Math.max(1, riders));

  return {
    routeFare,
    perRider: Math.round(routeFare / safeRiders / 50) * 50,
    riders: safeRiders,
    breakdown: [3, 2, 1].map((count) => ({
      riders: count,
      each: Math.round(routeFare / count / 50) * 50,
    })),
  };
}

export interface RideEstimate {
  route: RoutePath;
  /** Undefined on the volunteer track — there is no fare to show. */
  fare?: FareQuote;
}

export const rideService = {
  async listLocations(options?: RequestOptions): Promise<RideLocation[]> {
    return request(() => ALL_LOCATIONS, { delayMs: MockDelay.fast, ...options });
  },

  async searchDestinations(
    query: string,
    options?: RequestOptions,
  ): Promise<RideLocation[]> {
    return request(() => searchLocations(query), {
      delayMs: MockDelay.instant,
      ...options,
    });
  },

  async estimate(
    pickup: RideLocation,
    destination: RideLocation,
    track: DriverTrack,
    rideType: RideType,
    options?: RequestOptions,
  ): Promise<RideEstimate> {
    return request(
      () => {
        const route = buildRoute(pickup, destination, {
          seed: `${pickup.id}-${destination.id}`,
        });

        // Product Rule 1: volunteer rides carry no fare at all.
        if (track === DriverTrack.VOLUNTEER) {
          return { route };
        }

        const riders = rideType === RideType.SHARED ? 2 : 1;
        return { route, fare: quoteFare(route.distanceKm, riders) };
      },
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async listRides(options?: RequestOptions): Promise<Ride[]> {
    return request(() => PASSENGER_RIDES, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async getRide(id: string, options?: RequestOptions): Promise<Ride | null> {
    return request(() => findRide(id) ?? null, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  async getUpcomingEvent(options?: RequestOptions): Promise<Event> {
    return request(() => UPCOMING_EVENT, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  /**
   * Simulated matching. Resolves with a driver, or null when no driver is
   * available — the NO_MATCH branch is a real outcome, not an error.
   */
  async findDriver(
    track: DriverTrack,
    options?: RequestOptions & { forceNoMatch?: boolean },
  ): Promise<Driver | null> {
    return request(
      () => {
        if (options?.forceNoMatch) return null;
        const candidates = DRIVERS.filter(
          (driver) => driver.track === track && !driver.flagged,
        );
        return candidates[0] ?? null;
      },
      { delayMs: MockDelay.matching, ...options },
    );
  },

  /** Trips as the driver sees them, optionally narrowed to one track. */
  async listDriverTrips(
    track?: DriverTrack,
    options?: RequestOptions,
  ): Promise<Ride[]> {
    return request(
      () =>
        track ? DRIVER_TRIPS.filter((trip) => trip.track === track) : DRIVER_TRIPS,
      { delayMs: MockDelay.normal, ...options },
    );
  },

  /** Professional track only. Volunteer drivers have no earnings to list. */
  async listEarnings(options?: RequestOptions): Promise<DriverEarning[]> {
    return request(() => DRIVER_EARNINGS, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async listReceipts(options?: RequestOptions): Promise<Receipt[]> {
    return request(() => DRIVER_RECEIPTS, {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async getReceipt(
    id: string,
    options?: RequestOptions,
  ): Promise<Receipt | null> {
    return request(
      () => DRIVER_RECEIPTS.find((receipt) => receipt.id === id) ?? null,
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async listRequests(
    track: DriverTrack,
    options?: RequestOptions,
  ): Promise<RideRequest[]> {
    return request(
      () =>
        track === DriverTrack.VOLUNTEER ? DRIVER_REQUESTS : PROFESSIONAL_REQUESTS,
      { delayMs: MockDelay.normal, ...options },
    );
  },
};
