import { haversineKm, offsetCoordinates } from "@/lib/geo";
import { STORAGE_KEYS, PAID_RIDES_CONFIG } from "../../config";
import { RideServiceError } from "../../domain/errors";
import { isLive, isTerminal } from "../../domain/ride-status";
import type {
  AcceptOutcome,
  GeoPoint,
  Place,
  Ride,
  RideEvent,
  RideEventPayload,
  RideMessage,
  RideOffer,
  RideSummary,
  RouteGeometry,
} from "../../domain/types";
import type { MapProvider } from "../../maps/map-provider";
import { approximateRoute } from "../../maps/approximate-route";
import {
  MOCK_DRIVERS,
  MOCK_PLACES,
  MOCK_PRODUCTS,
  MOCK_QUICK_REPLIES_FROM_DRIVER,
  MOCK_REQUESTERS,
  naira,
} from "./mock-fixtures";
import { mockQuote } from "./mock-pricing";
import {
  compressedMs,
  computeDriverRide,
  computePassengerRide,
  type DriverAssignment,
  type MockScenario,
  type PassengerPlan,
} from "./mock-timeline";

/**
 * In-browser stand-in for the ride backend, used only in `mock` mode.
 *
 * It owns a small "database" persisted to localStorage (so reloads behave
 * like a real server), projects rides from their plans on a one-second tick,
 * and pushes realtime events to the mock realtime client. Matching, ETAs and
 * assignment all happen *here*, never in UI code.
 */

export type DriverScenario = "normal" | "already-taken" | "passenger-cancels";

interface MockWorld {
  scenario: MockScenario;
  driverScenario: DriverScenario;
  passenger: { plan: PassengerPlan | null; archived: string[]; history: RideSummary[] };
  driver: {
    online: boolean;
    origin: GeoPoint | null;
    offer: RideOffer | null;
    nextOfferAt: number | null;
    assignment: DriverAssignment | null;
    archived: string[];
    history: RideSummary[];
  };
  messages: Record<string, RideMessage[]>;
  /** Idempotency keys already processed, mapped to the ride they produced. */
  idempotency: Record<string, string>;
}

const TICK_MS = 1000;
const OFFER_TTL_MS = 18_000;
const FIRST_OFFER_DELAY_MS = 6_000;
const NEXT_OFFER_DELAY_MS = 12_000;

function seedHistory(role: "passenger" | "driver"): RideSummary[] {
  const day = 86_400_000;
  const now = Date.now();
  const rows: Array<[number, string, string, number, number, string]> = [
    [1, "Jabi Lake Mall", "Chida Event Centre", 2_350, 6_900, "Go"],
    [3, "Wuse Market", "Maitama", 3_100, 8_400, "Comfort"],
    [8, "Garki Area 11", "Ceddi Plaza", 1_800, 4_300, "Go"],
  ];
  return rows.map(([daysAgo, from, to, amount, meters, option], index) => ({
    id: `hist-${role}-${index}`,
    status: "COMPLETED" as const,
    createdAt: new Date(now - daysAgo * day - index * 3_600_000).toISOString(),
    pickupName: from,
    destinationName: to,
    optionName: option,
    vehicleClass: option === "Comfort" ? ("sedan" as const) : ("compact" as const),
    total: naira(role === "driver" ? Math.round(amount * 0.8) : amount),
    distanceMeters: meters,
    durationSeconds: Math.round(meters / 6.5),
    counterpartName: role === "driver" ? ["Adaeze", "Blessing", "Sarah"][index] : ["Emeka", "Chinedu", "Emeka"][index],
    ratingGiven: role === "passenger" ? 5 : undefined,
  }));
}

function freshWorld(): MockWorld {
  return {
    scenario: "normal",
    driverScenario: "normal",
    passenger: { plan: null, archived: [], history: seedHistory("passenger") },
    driver: { online: false, origin: null, offer: null, nextOfferAt: null, assignment: null, archived: [], history: seedHistory("driver") },
    messages: {},
    idempotency: {},
  };
}

function loadWorld(): MockWorld {
  if (typeof window === "undefined") return freshWorld();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.mockWorld);
    if (!raw) return freshWorld();
    return { ...freshWorld(), ...(JSON.parse(raw) as Partial<MockWorld>) };
  } catch {
    return freshWorld();
  }
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function summarise(ride: Ride, role: "passenger" | "driver"): RideSummary {
  return {
    id: ride.id,
    status: ride.status,
    createdAt: ride.createdAt,
    pickupName: ride.pickup.name,
    destinationName: ride.destination.name,
    optionName: ride.option.name,
    vehicleClass: ride.option.vehicleClass,
    total: ride.status === "COMPLETED" ? (role === "driver" ? (ride.driverEarning ?? ride.fare.total) : ride.fare.total) : null,
    distanceMeters: ride.route.distanceMeters,
    durationSeconds: ride.timestamps.startedAt && ride.timestamps.completedAt
      ? Math.round((Date.parse(ride.timestamps.completedAt) - Date.parse(ride.timestamps.startedAt)) / 1000)
      : null,
    counterpartName: role === "driver" ? ride.passenger?.displayName : ride.driver?.displayName,
    ratingGiven: ride.rating?.stars,
  };
}

type Listener = (event: RideEvent) => void;

export class MockBackend {
  private world: MockWorld = loadWorld();
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private readonly lastEmitted = new Map<string, { status: Ride["status"]; version: number }>();
  private readonly chatTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly mapProvider: MapProvider;

  constructor(mapProvider: MapProvider) {
    this.mapProvider = mapProvider;
  }

  // ─── Persistence and events ─────────────────────────────────────────────

  private save(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.mockWorld, JSON.stringify(this.world));
    } catch {
      // Storage full or blocked: the simulation keeps running in memory.
    }
  }

  private emit(rideId: string | null, payload: RideEventPayload, rideVersion: number | null = null): void {
    this.seq += 1;
    const event: RideEvent = { id: randomId("evt"), rideId, seq: this.seq, rideVersion, occurredAt: new Date().toISOString(), payload };
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  /** Recompute every live ride and push what changed. */
  tick(now: number = Date.now()): void {
    const passengerRide = this.passengerRide(now);
    if (passengerRide) this.publishRide(passengerRide, "passenger");

    const driver = this.world.driver;
    if (driver.assignment) {
      this.publishRide(computeDriverRide(driver.assignment, now), "driver");
    } else if (driver.online) {
      if (driver.offer && now > Date.parse(driver.offer.expiresAt ?? "") ) {
        const expired = driver.offer;
        driver.offer = null;
        driver.nextOfferAt = now + NEXT_OFFER_DELAY_MS;
        this.save();
        this.emit(expired.rideId, { type: "driver.request.expired", offerId: expired.offerId });
      } else if (!driver.offer && driver.nextOfferAt !== null && now >= driver.nextOfferAt) {
        driver.offer = this.createOffer(now);
        driver.nextOfferAt = null;
        this.save();
        this.emit(driver.offer.rideId, { type: "driver.request.received", offer: driver.offer });
      }
    }
  }

  private publishRide(ride: Ride, role: "passenger" | "driver"): void {
    const previous = this.lastEmitted.get(ride.id);
    if (!previous || previous.status !== ride.status) {
      this.lastEmitted.set(ride.id, { status: ride.status, version: ride.version });
      this.emit(ride.id, { type: "ride.updated", ride }, ride.version);
    } else if (!isTerminal(ride.status) && ride.driverLocation) {
      this.emit(ride.id, { type: "ride.driver.location_updated", location: ride.driverLocation, approach: ride.approach, progress: ride.progress }, null);
    }
    if (isTerminal(ride.status) || ride.status === "NO_DRIVERS") this.archive(ride, role);
  }

  private archive(ride: Ride, role: "passenger" | "driver"): void {
    if (ride.status === "NO_DRIVERS") return;
    const bucket = role === "passenger" ? this.world.passenger : this.world.driver;
    const summary = summarise(ride, role);
    const index = bucket.history.findIndex((item) => item.id === ride.id);
    if (index === -1) bucket.history.unshift(summary);
    else bucket.history[index] = summary;
    if (!bucket.archived.includes(ride.id)) bucket.archived.push(ride.id);
    this.save();
  }

  // ─── Scenarios (dev panel) ──────────────────────────────────────────────

  getScenarios(): { passenger: MockScenario; driver: DriverScenario } {
    return { passenger: this.world.scenario, driver: this.world.driverScenario };
  }

  setScenario(scenario: MockScenario): void {
    this.world.scenario = scenario;
    this.save();
  }

  setDriverScenario(scenario: DriverScenario): void {
    this.world.driverScenario = scenario;
    this.save();
  }

  reset(): void {
    this.world = freshWorld();
    this.lastEmitted.clear();
    this.save();
  }

  // ─── Passenger ──────────────────────────────────────────────────────────

  passengerRide(now: number = Date.now()): Ride | null {
    const plan = this.world.passenger.plan;
    return plan ? computePassengerRide(plan, now) : null;
  }

  /** The live ride, as `GET /rides/current` would return it. */
  currentPassengerRide(): Ride | null {
    const ride = this.passengerRide();
    if (!ride) return null;
    // A finished ride stays "current" until rated or dismissed, like a real
    // backend holding the receipt for the rider.
    if (ride.status === "COMPLETED" && ride.rating) return null;
    const endedAt = Date.parse(ride.timestamps.completedAt ?? ride.timestamps.cancelledAt ?? ride.updatedAt);
    const holdMs = ride.status === "COMPLETED" ? 15 * 60_000 : 2 * 60_000;
    if ((isTerminal(ride.status) || ride.status === "NO_DRIVERS") && Date.now() - endedAt > holdMs) return null;
    return ride;
  }

  findRide(rideId: string): Ride | null {
    const passenger = this.passengerRide();
    if (passenger?.id === rideId) return passenger;
    const assignment = this.world.driver.assignment;
    if (assignment?.rideId === rideId) return computeDriverRide(assignment, Date.now());
    return null;
  }

  history(role: "passenger" | "driver"): RideSummary[] {
    return (role === "passenger" ? this.world.passenger : this.world.driver).history;
  }

  async estimate(pickup: Place, destination: Place, signal?: AbortSignal) {
    const route = await this.mapProvider.calculateRoute([pickup.point, destination.point], signal);
    const options = MOCK_PRODUCTS.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      vehicleClass: product.vehicleClass,
      capacity: product.capacity,
      shared: product.shared,
      pickupEtaSeconds: Math.round(product.pickupEtaSeconds * between(0.8, 1.2)),
      fare: mockQuote(product, route),
      available: !(product.vehicleClass === "premium" && route.distanceMeters < 1500),
      unavailableReason: product.vehicleClass === "premium" && route.distanceMeters < 1500 ? "Not offered for trips under 1.5 km" : undefined,
    }));
    return { route, options };
  }

  async requestRide(
    input: { optionId: string; paymentLabel: string; pickup: Place; destination: Place; route: RouteGeometry },
    idempotencyKey: string,
  ): Promise<Ride> {
    const previous = this.world.idempotency[idempotencyKey];
    const existing = previous ? this.passengerRide() : null;
    if (existing && existing.id === previous) return existing;
    const live = this.passengerRide();
    if (live && isLive(live.status)) throw new RideServiceError("conflict");

    const product = MOCK_PRODUCTS.find((item) => item.id === input.optionId) ?? MOCK_PRODUCTS[0];
    const driver = MOCK_DRIVERS[product.vehicleClass];
    const driverStart = offsetCoordinates(input.pickup.point, between(-1600, 1600), between(-1600, 1600));
    const approachRoute = await this.routeOrApproximate([driverStart, input.pickup.point]);
    const now = Date.now();
    const rideId = randomId("ride");

    const plan: PassengerPlan = {
      rideId,
      createdAt: now,
      requestedAt: now,
      scenario: this.world.scenario,
      pickup: input.pickup,
      destination: input.destination,
      route: input.route,
      option: { id: product.id, name: product.name, vehicleClass: product.vehicleClass, capacity: product.capacity, shared: product.shared },
      fare: mockQuote(product, input.route),
      paymentLabel: input.paymentLabel,
      driver,
      approachRoute,
      durations: {
        searchMs: this.world.scenario === "slow-match" ? 16_000 : 5_500,
        assignedMs: 2_800,
        approachMs: compressedMs(approachRoute.durationSeconds, 28_000, 70_000),
        waitMs: 9_000,
        tripMs: compressedMs(input.route.durationSeconds, 40_000, 110_000),
      },
      shared: product.shared
        ? { riderCount: 2, seatsAvailable: 0, coRiders: [{ alias: "Rider 2", boarded: false }], mayDetour: true, maxExtraSeconds: 360 }
        : undefined,
      sos: "none",
      // No public tracking page exists yet, so the mock issues no link and
      // sharing falls back to a text summary.
      shareUrl: undefined,
    };
    this.world.passenger.plan = plan;
    this.world.idempotency[idempotencyKey] = rideId;
    this.save();
    return computePassengerRide(plan, now);
  }

  retrySearch(rideId: string, optionId: string | null): Ride {
    const plan = this.requirePlan(rideId);
    const ride = computePassengerRide(plan, Date.now());
    if (ride.status !== "NO_DRIVERS") return ride;
    const product = optionId ? MOCK_PRODUCTS.find((item) => item.id === optionId) : undefined;
    // A retry gets a fresh chance at a match.
    plan.scenario = "normal";
    plan.requestedAt = Date.now();
    if (product) {
      plan.option = { id: product.id, name: product.name, vehicleClass: product.vehicleClass, capacity: product.capacity, shared: product.shared };
      plan.fare = mockQuote(product, plan.route);
      plan.driver = MOCK_DRIVERS[product.vehicleClass];
    }
    this.lastEmitted.delete(rideId);
    this.save();
    return computePassengerRide(plan, Date.now());
  }

  cancelPassengerRide(rideId: string, reason: string | null): Ride {
    const plan = this.requirePlan(rideId);
    const ride = computePassengerRide(plan, Date.now());
    if (isTerminal(ride.status)) return ride;
    plan.cancelledAt = Date.now();
    plan.cancelledBy = "passenger";
    plan.cancelReason = reason ?? undefined;
    this.save();
    return computePassengerRide(plan, Date.now());
  }

  ratePassengerRide(rideId: string, stars: number): Ride {
    const plan = this.requirePlan(rideId);
    plan.rating = { stars, submittedAt: new Date().toISOString() };
    const ride = computePassengerRide(plan, Date.now());
    this.archive(ride, "passenger");
    this.save();
    return ride;
  }

  sos(rideId: string): void {
    const plan = this.world.passenger.plan;
    if (plan?.rideId === rideId) {
      plan.sos = "sent";
      this.save();
    }
    const timer = setTimeout(() => {
      this.chatTimers.delete(timer);
      if (this.world.passenger.plan?.rideId === rideId) {
        this.world.passenger.plan.sos = "acknowledged";
        this.save();
      }
      this.emit(rideId, { type: "ride.sos.acknowledged" });
    }, 2_500);
    this.chatTimers.add(timer);
  }

  private requirePlan(rideId: string): PassengerPlan {
    const plan = this.world.passenger.plan;
    if (!plan || plan.rideId !== rideId) throw new RideServiceError("not_found");
    return plan;
  }

  private async routeOrApproximate(points: GeoPoint[]): Promise<RouteGeometry> {
    try {
      return await this.mapProvider.calculateRoute(points);
    } catch {
      return approximateRoute(points);
    }
  }

  // ─── Driver ─────────────────────────────────────────────────────────────

  driverAvailability() {
    const driver = this.world.driver;
    if (driver.assignment && !isTerminal(computeDriverRide(driver.assignment, Date.now()).status)) return "ON_TRIP" as const;
    return driver.online ? ("ONLINE" as const) : ("OFFLINE" as const);
  }

  setDriverOrigin(point: GeoPoint): void {
    this.world.driver.origin = point;
  }

  setOnline(online: boolean) {
    const driver = this.world.driver;
    if (!online && this.driverAvailability() === "ON_TRIP") return "ON_TRIP" as const;
    driver.online = online;
    driver.offer = online ? driver.offer : null;
    driver.nextOfferAt = online ? Date.now() + FIRST_OFFER_DELAY_MS : null;
    this.save();
    return online ? ("ONLINE" as const) : ("OFFLINE" as const);
  }

  currentDriverRide(): Ride | null {
    const assignment = this.world.driver.assignment;
    if (!assignment) return null;
    const ride = computeDriverRide(assignment, Date.now());
    // The summary screen is shown once; afterwards the driver is free again.
    if (isTerminal(ride.status) && this.world.driver.archived.includes(ride.id)) {
      const finishedAt = Date.parse(ride.timestamps.completedAt ?? ride.timestamps.cancelledAt ?? ride.updatedAt);
      if (Date.now() - finishedAt > 120_000) return null;
    }
    return ride;
  }

  private createOffer(now: number): RideOffer {
    const origin = this.world.driver.origin ?? PAID_RIDES_CONFIG.defaultCenter;
    const nearby = MOCK_PLACES.map((place) => ({ place, km: haversineKm(origin, place) })).sort((a, b) => a.km - b.km);
    let pickup: Place;
    let destination: Place;
    if (nearby[0].km < 8) {
      const from = nearby[Math.floor(Math.random() * Math.min(3, nearby.length))].place;
      const options = MOCK_PLACES.filter((place) => place.name !== from.name);
      const to = options[Math.floor(Math.random() * options.length)];
      pickup = { id: randomId("pl"), name: from.name, secondary: from.secondary, point: { lat: from.lat, lng: from.lng }, source: "search" };
      destination = { id: randomId("pl"), name: to.name, secondary: to.secondary, point: { lat: to.lat, lng: to.lng }, source: "search" };
    } else {
      // Testing far from Abuja: synthesise points around wherever the driver is.
      const p = offsetCoordinates(origin, between(-1400, 1400), between(-1400, 1400));
      const d = offsetCoordinates(p, between(-5000, 5000), between(-5000, 5000));
      pickup = { id: randomId("pl"), name: "Pickup point", secondary: "Near your location", point: p, source: "search" };
      destination = { id: randomId("pl"), name: "Drop-off point", secondary: "Within the city", point: d, source: "search" };
    }
    const pickupKm = haversineKm(origin, pickup.point) * 1.3;
    const tripKm = haversineKm(pickup.point, destination.point) * 1.3;
    const product = Math.random() > 0.75 ? MOCK_PRODUCTS[1] : MOCK_PRODUCTS[0];
    const tripRoute: RouteGeometry = { points: [pickup.point, destination.point], distanceMeters: Math.round(tripKm * 1000), durationSeconds: Math.round((tripKm * 1000) / 6.7), source: "approximate" };
    const fare = mockQuote(product, tripRoute);
    const requester = MOCK_REQUESTERS[Math.floor(Math.random() * MOCK_REQUESTERS.length)];
    return {
      offerId: randomId("offer"),
      rideId: randomId("ride"),
      expiresAt: new Date(now + OFFER_TTL_MS).toISOString(),
      receivedAt: new Date(now).toISOString(),
      pickup,
      destination,
      pickupDistanceMeters: Math.round(pickupKm * 1000),
      pickupEtaSeconds: Math.round((pickupKm * 1000) / 6.7),
      tripDistanceMeters: tripRoute.distanceMeters,
      tripDurationSeconds: tripRoute.durationSeconds,
      earning: { amountMinor: Math.round(fare.total.amountMinor * 0.8), currency: fare.total.currency },
      passenger: requester,
      optionName: product.name,
      vehicleClass: product.vehicleClass,
      shared: product.shared,
    };
  }

  async accept(offerId: string, idempotencyKey: string): Promise<{ outcome: AcceptOutcome; ride?: Ride }> {
    const driver = this.world.driver;
    const settled = this.world.idempotency[idempotencyKey];
    if (settled && driver.assignment?.rideId === settled) return { outcome: "accepted", ride: computeDriverRide(driver.assignment, Date.now()) };

    const offer = driver.offer;
    if (!offer || offer.offerId !== offerId) return { outcome: "request_expired" };
    if (Date.now() > Date.parse(offer.expiresAt ?? "")) return { outcome: "request_expired" };
    if (this.world.driverScenario === "already-taken") {
      driver.offer = null;
      driver.nextOfferAt = Date.now() + NEXT_OFFER_DELAY_MS;
      this.save();
      return { outcome: "already_taken" };
    }

    const origin = driver.origin ?? offsetCoordinates(offer.pickup.point, 900, -700);
    const [approachRoute, tripRoute] = await Promise.all([
      this.routeOrApproximate([origin, offer.pickup.point]),
      this.routeOrApproximate([offer.pickup.point, (offer.destination ?? offer.pickup).point]),
    ]);
    const now = Date.now();
    const product = MOCK_PRODUCTS.find((item) => item.name === offer.optionName) ?? MOCK_PRODUCTS[0];
    const fare = mockQuote(product, tripRoute);
    driver.assignment = {
      rideId: offer.rideId,
      offer,
      acceptedAt: now,
      approachRoute,
      tripRoute,
      approachMs: compressedMs(approachRoute.durationSeconds, 25_000, 60_000),
      tripMs: compressedMs(tripRoute.durationSeconds, 40_000, 100_000),
      passenger: { displayName: offer.passenger.displayName, rating: offer.passenger.rating, contact: { call: "masked", callHref: "tel:+2340000000000", chat: true } },
      fare,
      // The driver is paid what they were offered, not a re-quote.
      earning: offer.earning ?? { amountMinor: Math.round(fare.total.amountMinor * 0.8), currency: fare.total.currency },
      passengerCancelsAt: this.world.driverScenario === "passenger-cancels" ? now + 12_000 : undefined,
    };
    driver.offer = null;
    this.world.idempotency[idempotencyKey] = offer.rideId;
    this.save();
    return { outcome: "accepted", ride: computeDriverRide(driver.assignment, now) };
  }

  decline(offerId: string): void {
    const driver = this.world.driver;
    if (driver.offer?.offerId === offerId) {
      driver.offer = null;
      driver.nextOfferAt = Date.now() + NEXT_OFFER_DELAY_MS;
      this.save();
    }
  }

  driverAction(rideId: string, action: "arrive" | "start" | "complete" | "cancel"): Ride {
    const assignment = this.world.driver.assignment;
    if (!assignment || assignment.rideId !== rideId) throw new RideServiceError("not_found");
    const ride = computeDriverRide(assignment, Date.now());
    if (ride.status === "CANCELLED") return ride;
    const now = Date.now();
    // Idempotent: repeating an action that already happened changes nothing.
    if (action === "arrive" && assignment.arrivedAt === undefined) assignment.arrivedAt = now;
    if (action === "start" && assignment.arrivedAt !== undefined && assignment.startedAt === undefined) assignment.startedAt = now;
    if (action === "complete" && assignment.startedAt !== undefined && assignment.completedAt === undefined) assignment.completedAt = now;
    if (action === "cancel" && assignment.startedAt === undefined && assignment.cancelledAt === undefined) {
      assignment.cancelledAt = now;
      assignment.cancelledBy = "driver";
    }
    if (action === "complete" || action === "cancel") {
      this.world.driver.nextOfferAt = this.world.driver.online ? now + NEXT_OFFER_DELAY_MS : null;
    }
    this.save();
    return computeDriverRide(assignment, now);
  }

  // ─── Chat ───────────────────────────────────────────────────────────────

  messages(rideId: string): RideMessage[] {
    return this.world.messages[rideId] ?? [];
  }

  sendMessage(rideId: string, clientId: string, body: string): RideMessage {
    const list = (this.world.messages[rideId] ??= []);
    const existing = list.find((message) => message.clientId === clientId);
    if (existing) return existing;
    const message: RideMessage = { id: randomId("msg"), clientId, rideId, from: "me", body, sentAt: new Date().toISOString(), status: "sent" };
    list.push(message);
    this.save();
    this.simulateCounterpart(rideId, message, list.filter((item) => item.from === "me").length);
    return message;
  }

  private later(ms: number, run: () => void): void {
    const timer = setTimeout(() => {
      this.chatTimers.delete(timer);
      run();
    }, ms);
    this.chatTimers.add(timer);
  }

  private simulateCounterpart(rideId: string, message: RideMessage, sentCount: number): void {
    const setStatus = (status: "delivered" | "read") => {
      const stored = this.world.messages[rideId]?.find((item) => item.id === message.id);
      if (stored) stored.status = status;
      this.save();
      this.emit(rideId, { type: status === "delivered" ? "chat.message.delivered" : "chat.message.read", messageId: message.id });
    };
    this.later(900, () => setStatus("delivered"));
    this.later(2_200, () => setStatus("read"));
    // The simulated counterpart answers the first few messages only.
    if (sentCount > 3) return;
    this.later(2_800, () => this.emit(rideId, { type: "chat.typing.started" }));
    this.later(5_200, () => {
      const reply: RideMessage = {
        id: randomId("msg"),
        rideId,
        from: "them",
        body: MOCK_QUICK_REPLIES_FROM_DRIVER[(sentCount - 1) % MOCK_QUICK_REPLIES_FROM_DRIVER.length],
        sentAt: new Date().toISOString(),
        status: "delivered",
      };
      (this.world.messages[rideId] ??= []).push(reply);
      this.save();
      this.emit(rideId, { type: "chat.message.created", message: reply });
    });
  }

  markRead(rideId: string): void {
    for (const message of this.world.messages[rideId] ?? []) if (message.from === "them") message.status = "read";
    this.save();
  }
}
