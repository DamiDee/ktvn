import { bearingDegrees, cumulativeDistances, pointAlongPath } from "../../../../lib/geo.ts";
import type {
  CancelledBy,
  DriverPublicProfile,
  FareQuote,
  GeoPoint,
  Money,
  PassengerPublicProfile,
  Place,
  Ride,
  RideOffer,
  RideOption,
  RideStatus,
  RouteGeometry,
  SharedRideInfo,
  SosStatus,
} from "../../domain/types.ts";

/**
 * The simulated server. A mock ride is a *plan* (what will happen and when)
 * plus a pure function that projects it onto a moment in time. Because the
 * projection depends only on the plan and the clock, a reload reconstructs
 * exactly the same ride — the same guarantee a real server gives.
 *
 * Movement is time-compressed (`SIMULATION_SPEED`) so a demo trip takes a
 * minute or two, while the ETA shown stays in real-world minutes.
 */

export const SIMULATION_SPEED = 8;
export const ARRIVING_METERS = 300;

export type MockScenario = "normal" | "no-drivers" | "driver-cancels" | "payment-fails" | "slow-match";

export interface PassengerPlan {
  rideId: string;
  createdAt: number;
  /** Reset when the rider retries after NO_DRIVERS. */
  requestedAt: number;
  scenario: MockScenario;
  pickup: Place;
  destination: Place;
  route: RouteGeometry;
  option: Pick<RideOption, "id" | "name" | "vehicleClass" | "capacity" | "shared">;
  fare: FareQuote;
  paymentLabel: string;
  driver: DriverPublicProfile;
  approachRoute: RouteGeometry;
  durations: { searchMs: number; assignedMs: number; approachMs: number; waitMs: number; tripMs: number };
  shared?: SharedRideInfo;
  cancelledAt?: number;
  cancelledBy?: CancelledBy;
  cancelReason?: string;
  rating?: { stars: number; submittedAt: string };
  sos: SosStatus;
  shareUrl?: string;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function compressedMs(seconds: number, minMs: number, maxMs: number): number {
  return Math.round(Math.min(maxMs, Math.max(minMs, (seconds * 1000) / SIMULATION_SPEED)));
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

interface Travel {
  point: GeoPoint;
  heading: number;
  remainingMeters: number;
  etaSeconds: number;
}

/** Position, heading and remaining distance after travelling `progress` of a route. */
export function travelAlong(route: RouteGeometry, progress: number): Travel {
  const p = clamp01(progress);
  const cumulative = cumulativeDistances(route.points);
  const { position, heading, segmentIndex } = pointAlongPath(route.points, p, cumulative);
  // Headings at the very end of a path are noisy; reuse the last segment's.
  const safeHeading =
    p >= 1 && route.points.length > 1
      ? bearingDegrees(route.points[route.points.length - 2], route.points[route.points.length - 1])
      : segmentIndex >= 0
        ? heading
        : 0;
  return {
    point: position,
    heading: (safeHeading + 360) % 360,
    remainingMeters: Math.round(route.distanceMeters * (1 - p)),
    etaSeconds: Math.round(route.durationSeconds * (1 - p)),
  };
}

type Stage = "REQUESTED" | "SEARCHING" | "NO_DRIVERS" | "ASSIGNED" | "APPROACH" | "ARRIVED" | "TRIP" | "COMPLETED";

interface StageAt {
  stage: Stage;
  index: number;
  startedAt: number;
  /** Progress through a moving stage (approach or trip). */
  progress: number;
}

const REQUEST_MS = 900;

export function passengerStageAt(plan: PassengerPlan, now: number): StageAt {
  const d = plan.durations;
  let t = plan.requestedAt;
  if (now < t + REQUEST_MS) return { stage: "REQUESTED", index: 0, startedAt: t, progress: 0 };
  t += REQUEST_MS;
  if (now < t + d.searchMs) return { stage: "SEARCHING", index: 1, startedAt: t, progress: 0 };
  t += d.searchMs;
  if (plan.scenario === "no-drivers") return { stage: "NO_DRIVERS", index: 2, startedAt: t, progress: 0 };
  if (now < t + d.assignedMs) return { stage: "ASSIGNED", index: 3, startedAt: t, progress: 0 };
  t += d.assignedMs;
  if (now < t + d.approachMs) return { stage: "APPROACH", index: 4, startedAt: t, progress: (now - t) / d.approachMs };
  t += d.approachMs;
  if (now < t + d.waitMs) return { stage: "ARRIVED", index: 5, startedAt: t, progress: 0 };
  t += d.waitMs;
  if (now < t + d.tripMs) return { stage: "TRIP", index: 6, startedAt: t, progress: (now - t) / d.tripMs };
  t += d.tripMs;
  return { stage: "COMPLETED", index: 7, startedAt: t, progress: 1 };
}

/** When the scenario makes the driver cancel: a third of the way through the approach. */
export function scheduledDriverCancel(plan: PassengerPlan): number | null {
  if (plan.scenario !== "driver-cancels") return null;
  const d = plan.durations;
  return plan.requestedAt + REQUEST_MS + d.searchMs + d.assignedMs + d.approachMs * 0.35;
}

function stageVersion(stage: StageAt, at: number): number {
  // Monotonic: stage ordinal dominates, one tick per second within a stage.
  return stage.index * 100_000 + Math.min(99_999, Math.floor(Math.max(0, at - stage.startedAt) / 1000)) + 1;
}

export function computePassengerRide(plan: PassengerPlan, now: number): Ride {
  const driverCancel = scheduledDriverCancel(plan);
  const cancelledAt =
    plan.cancelledAt ?? (driverCancel !== null && now >= driverCancel ? driverCancel : undefined);
  const cancelledBy: CancelledBy | undefined = plan.cancelledAt !== undefined ? plan.cancelledBy : cancelledAt !== undefined ? "driver" : undefined;

  // A cancelled ride is frozen at the moment it was cancelled.
  const at = cancelledAt !== undefined ? Math.min(now, cancelledAt) : now;
  const stage = passengerStageAt(plan, at);
  const d = plan.durations;
  const searchEnd = plan.requestedAt + REQUEST_MS + d.searchMs;

  const base: Ride = {
    id: plan.rideId,
    version: stageVersion(stage, at),
    status: "REQUESTED",
    createdAt: iso(plan.createdAt),
    updatedAt: iso(Math.max(stage.startedAt, plan.requestedAt)),
    pickup: plan.pickup,
    destination: plan.destination,
    route: plan.route,
    option: plan.option,
    fare: plan.fare,
    payment: { status: "pending", methodLabel: plan.paymentLabel },
    shared: plan.shared,
    timestamps: {},
    sos: { status: plan.sos },
    shareUrl: plan.shareUrl,
  };

  let ride: Ride = base;
  const withDriver = (status: RideStatus, location: Travel, extra: Partial<Ride> = {}): Ride => ({
    ...base,
    status,
    driver: plan.driver,
    driverLocation: { point: location.point, heading: location.heading, speedMps: null, accuracyMeters: 8, recordedAt: iso(at) },
    timestamps: { assignedAt: iso(searchEnd) },
    ...extra,
  });

  switch (stage.stage) {
    case "REQUESTED":
      ride = base;
      break;
    case "SEARCHING":
      ride = { ...base, status: "SEARCHING" };
      break;
    case "NO_DRIVERS":
      ride = { ...base, status: "NO_DRIVERS" };
      break;
    case "ASSIGNED":
    case "APPROACH": {
      const travel = travelAlong(plan.approachRoute, stage.stage === "ASSIGNED" ? 0 : stage.progress);
      const status: RideStatus =
        stage.stage === "ASSIGNED" ? "DRIVER_ASSIGNED" : travel.remainingMeters <= ARRIVING_METERS ? "DRIVER_ARRIVING" : "DRIVER_EN_ROUTE";
      ride = withDriver(status, travel, {
        approach: { etaSeconds: travel.etaSeconds, distanceMeters: travel.remainingMeters, route: plan.approachRoute },
      });
      break;
    }
    case "ARRIVED": {
      const travel = travelAlong(plan.approachRoute, 1);
      ride = withDriver("DRIVER_ARRIVED", travel, {
        approach: { etaSeconds: 0, distanceMeters: 0 },
        timestamps: { assignedAt: iso(searchEnd), arrivedAt: iso(stage.startedAt) },
      });
      break;
    }
    case "TRIP": {
      const travel = travelAlong(plan.route, stage.progress);
      ride = withDriver("IN_PROGRESS", travel, {
        progress: { etaSeconds: travel.etaSeconds, remainingMeters: travel.remainingMeters },
        timestamps: { assignedAt: iso(searchEnd), arrivedAt: iso(stage.startedAt - d.waitMs), startedAt: iso(stage.startedAt) },
      });
      break;
    }
    case "COMPLETED": {
      const travel = travelAlong(plan.route, 1);
      const failed = plan.scenario === "payment-fails";
      ride = withDriver("COMPLETED", travel, {
        progress: { etaSeconds: 0, remainingMeters: 0 },
        fare: { ...plan.fare, isEstimate: false, range: undefined },
        payment: { status: failed ? "failed" : "paid", methodLabel: plan.paymentLabel },
        timestamps: {
          assignedAt: iso(searchEnd),
          arrivedAt: iso(stage.startedAt - d.tripMs - d.waitMs),
          startedAt: iso(stage.startedAt - d.tripMs),
          completedAt: iso(stage.startedAt),
        },
        rating: plan.rating,
      });
      if (plan.rating) ride.version += 1;
      break;
    }
  }

  if (cancelledAt !== undefined) {
    ride = {
      ...ride,
      status: "CANCELLED",
      version: ride.version + 50_000,
      cancellation: { by: cancelledBy ?? "passenger", reason: plan.cancelReason },
      payment: { status: "not_required", methodLabel: plan.paymentLabel },
      timestamps: { ...ride.timestamps, cancelledAt: iso(cancelledAt) },
      approach: undefined,
    };
  }
  return ride;
}

// ─── Driver side ──────────────────────────────────────────────────────────────

export interface DriverAssignment {
  rideId: string;
  offer: RideOffer;
  acceptedAt: number;
  approachRoute: RouteGeometry;
  tripRoute: RouteGeometry;
  approachMs: number;
  tripMs: number;
  passenger: PassengerPublicProfile;
  fare: FareQuote;
  earning: Money;
  arrivedAt?: number;
  startedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancelledBy?: CancelledBy;
  /** The simulated rider cancels at this moment, when the scenario says so. */
  passengerCancelsAt?: number;
}

export function computeDriverRide(assignment: DriverAssignment, now: number): Ride {
  const a = assignment;
  const cancelledAt = a.cancelledAt ?? (a.passengerCancelsAt !== undefined && !a.startedAt && now >= a.passengerCancelsAt ? a.passengerCancelsAt : undefined);
  const at = cancelledAt !== undefined ? Math.min(now, cancelledAt) : now;

  let status: RideStatus;
  let travel: Travel;
  if (a.completedAt !== undefined && at >= a.completedAt) {
    status = "COMPLETED";
    travel = travelAlong(a.tripRoute, 1);
  } else if (a.startedAt !== undefined && at >= a.startedAt) {
    status = "IN_PROGRESS";
    travel = travelAlong(a.tripRoute, (at - a.startedAt) / a.tripMs);
  } else if (a.arrivedAt !== undefined && at >= a.arrivedAt) {
    status = "DRIVER_ARRIVED";
    travel = travelAlong(a.approachRoute, 1);
  } else {
    travel = travelAlong(a.approachRoute, (at - a.acceptedAt) / a.approachMs);
    status = travel.remainingMeters <= ARRIVING_METERS ? "DRIVER_ARRIVING" : "DRIVER_EN_ROUTE";
  }

  const milestones = [a.arrivedAt, a.startedAt, a.completedAt].filter((value) => value !== undefined && value <= at).length;
  const lastMilestone = Math.max(a.acceptedAt, ...[a.arrivedAt, a.startedAt, a.completedAt].filter((value): value is number => value !== undefined && value <= at));
  let version = milestones * 100_000 + Math.min(99_999, Math.floor((at - lastMilestone) / 1000)) + 1;

  const destination: Place = a.offer.destination ?? a.offer.pickup;
  let ride: Ride = {
    id: a.rideId,
    version,
    status,
    createdAt: a.offer.receivedAt,
    updatedAt: iso(lastMilestone),
    pickup: a.offer.pickup,
    destination,
    route: a.tripRoute,
    option: { id: a.offer.optionName, name: a.offer.optionName, vehicleClass: a.offer.vehicleClass, capacity: 4, shared: a.offer.shared },
    fare: status === "COMPLETED" ? { ...a.fare, isEstimate: false, range: undefined } : a.fare,
    payment: { status: status === "COMPLETED" ? "paid" : "pending", methodLabel: "Cash" },
    passenger: a.passenger,
    driverEarning: a.earning,
    driverLocation: { point: travel.point, heading: travel.heading, speedMps: null, accuracyMeters: 6, recordedAt: iso(at) },
    approach:
      status === "DRIVER_EN_ROUTE" || status === "DRIVER_ARRIVING"
        ? { etaSeconds: travel.etaSeconds, distanceMeters: travel.remainingMeters, route: a.approachRoute }
        : undefined,
    progress: status === "IN_PROGRESS" ? { etaSeconds: travel.etaSeconds, remainingMeters: travel.remainingMeters } : undefined,
    timestamps: {
      assignedAt: iso(a.acceptedAt),
      arrivedAt: a.arrivedAt !== undefined ? iso(a.arrivedAt) : undefined,
      startedAt: a.startedAt !== undefined ? iso(a.startedAt) : undefined,
      completedAt: a.completedAt !== undefined ? iso(a.completedAt) : undefined,
    },
    sos: { status: "none" },
  };

  if (cancelledAt !== undefined) {
    version += 50_000;
    ride = {
      ...ride,
      version,
      status: "CANCELLED",
      approach: undefined,
      cancellation: { by: a.cancelledBy ?? "passenger" },
      payment: { status: "not_required", methodLabel: "Cash" },
      timestamps: { ...ride.timestamps, cancelledAt: iso(cancelledAt) },
    };
  }
  return ride;
}
