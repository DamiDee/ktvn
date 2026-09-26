"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BusFront, Ticket, MapPin, Clock, ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { PushNotificationBanner } from "@/components/ui/push-notification-banner";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import {
  activeBooking,
  availableCapacity,
  busCanBoard,
  queryString,
} from "@/lib/freebus-contract";
import { extractArray, scheduledJourneys, tripCanBook, watParts, type ScheduledJourney } from "@/lib/trips";
import type { ApiBooking, ApiBus, ApiPoint, ApiRoute, ApiRideRequest, ApiTrip } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

const routeCanBook = (journey: ScheduledJourney) => tripCanBook(journey.trip, { ...journey, id: journey.route_id });

type Direction = "Pickup" | "Dropoff";

/** Abuja is UTC+01:00 all year, so a WAT calendar day needs no DST handling. */
function watToday(now = new Date()) {
  return new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
}

/** "Today", "Tomorrow", or "Sat 4 Oct" — a member reads days, not ISO dates. */
function dayLabel(date: string) {
  const today = watToday();
  if (date === today) return "Today";
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (date === tomorrow) return "Tomorrow";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "15:00:00" → "3:00 pm". The API publishes WAT wall-clock strings. */
function timeLabel(time: string) {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return time;
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${minutes ?? "00"} ${suffix}`;
}

export function LiveMemberBuses() {
  const router = useRouter();
  const client = useQueryClient();
  const { toast } = useToast();
  const [direction, setDirection] = useState<Direction>("Pickup");
  const [point, setPoint] = useState("");
  const [pending, setPending] = useState<ScheduledJourney | null>(null);
  const [cancel, setCancel] = useState<ApiBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // Everything is loaded once. Choosing a journey never waits on the network.
  const routeRecords = useLiveQuery<ApiRoute[]>("routes");
  const trips = useLiveQuery<ApiTrip[]>("trips");
  const journeys = useMemo(() => (routeRecords.data || trips.data) ? scheduledJourneys(routeRecords.data, trips.data) : undefined, [routeRecords.data, trips.data]);
  const routes = { data: journeys, error: routeRecords.error ?? trips.error };
  const buses = useLiveQuery<ApiBus[]>("buses");
  const points = useLiveQuery<ApiPoint[]>("points");
  const bookings = useLiveQuery<ApiBooking[]>("bookings/me");

  const isLoading = routeRecords.isLoading || trips.isLoading;
  const criticalError = routes.error;
  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });

  const ready = !isLoading && Boolean(routes.data);

  const model = useMemo(() => {
    if (!routes.data) return null;
    const allBuses = extractArray<ApiBus>(buses.data);
    const allBookings = extractArray<ApiBooking>(bookings.data);
    const busesById = new Map(allBuses.map((b) => [b.id, b]));
    const seatsOn = (route: ScheduledJourney) => {
      // Prefer matching by current_trip_id (set once the trip is active/boarding).
      // Fall back to the trip's own bus_id for upcoming trips where the bus hasn't
      // updated current_trip_id yet (it is still null until the journey starts).
      const byTripId = allBuses.filter((bus) => bus.current_trip_id === route.id);
      if (byTripId.length > 0) return byTripId.reduce((total, bus) => total + availableCapacity(bus), 0);

      // Trip is NotStarted — bus assigned but not yet "current". Use full remaining capacity.
      const assignedBus = route.trip.bus_id ? busesById.get(route.trip.bus_id) : undefined;
      if (assignedBus) {
        if (assignedBus.status === "Maintenance") return 0;
        return Math.max(1, assignedBus.capacity - assignedBus.current_passenger_count);
      }

      // If no bus is explicitly assigned yet (bus_id is null/unassigned or bus not in list),
      // check if there are available non-maintenance buses in the fleet.
      const fleet = allBuses.filter((b) => b.status !== "Maintenance");
      if (fleet.length > 0) {
        return Math.max(...fleet.map((b) => Math.max(1, b.capacity - b.current_passenger_count)));
      }

      // Fallback: If no fleet buses returned by API, assume default seat capacity (50) for scheduled departures.
      return 50;
    };

    const zeroFare = routes.data.filter((route) => Number(route.fare ?? 0) === 0);
    // An unavailable journey is noise on a booking screen: it is counted, not listed.
    const bookable = zeroFare.filter((route) => routeCanBook(route) && seatsOn(route) > 0);

    const routesById = new Map(routes.data.map((route) => [route.id, route]));
    const when = (route: ScheduledJourney) => `${route.departure_date}T${route.departure_time}`;

    // A seat on a finished journey belongs in history, not on a screen headed
    // "your next journey" — those are sorted out and left to the trips page.
    const tickets = allBookings
      .filter(activeBooking)
      .filter((booking) => {
        const route = routesById.get(booking.trip_id ?? "");
        return !route || !route.is_completed;
      })
      .sort((a, b) => {
        const first = routesById.get(a.trip_id ?? "");
        const second = routesById.get(b.trip_id ?? "");
        if (!first || !second) return first ? -1 : second ? 1 : 0;
        return when(first).localeCompare(when(second));
      });

    const sorted = [...bookable].sort((a, b) => when(a).localeCompare(when(b)));
    return { sorted, tickets, seatsOn };
  }, [routes.data, buses.data, bookings.data]);

  if (criticalError)
    return (
      <>
        <ErrorState
          title="We couldn't load Free Buses"
          description={criticalError.message}
          onRetry={() => void refresh()}
        />
        {criticalError instanceof FreebusError && criticalError.status === 401 ? (
          <ButtonLink href="/login">Sign in again</ButtonLink>
        ) : null}
      </>
    );
  if (!ready || !model) return <PageLoader message="Finding buses near you" />;

  const { sorted, tickets, seatsOn } = model;
  const pointsById = new Map(extractArray<ApiPoint>(points.data).map((p) => [p.id, p]));
  const location = (id: string) => pointsById.get(id)?.name ?? "Location unavailable";
  const routesById = new Map(extractArray<ScheduledJourney>(routes.data).map((r) => [r.id, r]));
  const busesById = new Map(extractArray<ApiBus>(buses.data).map((b) => [b.id, b]));

  const forDirection = sorted.filter((route) => {
    const raw = (route.ride_type || "Pickup").toLowerCase();
    const isDropoff = raw.includes("drop") || raw.includes("from") || raw.includes("home");
    const isPickup = raw.includes("pick") || raw.includes("to") || raw.includes("service");
    const isRound = raw.includes("round");

    if (direction === "Dropoff") {
      return isDropoff || isRound;
    } else {
      return isPickup || isRound || (!isDropoff && !isRound);
    }
  });

  // Only offer stops that actually have a bus today — an empty filter is a dead end.
  const stopKey = (route: ScheduledJourney) =>
    direction === "Dropoff" ? route.end_point : route.start_point;
  const stops = [...new Set(forDirection.map(stopKey))]
    .map((id) => pointsById.get(id))
    .filter((p): p is ApiPoint => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name));

  const visible = point ? forDirection.filter((route) => stopKey(route) === point) : forDirection;

  const byDay = visible.reduce<Record<string, ScheduledJourney[]>>((groups, route) => {
    (groups[route.departure_date] ??= []).push(route);
    return groups;
  }, {});

  async function reserve() {
    if (!pending) return;
    setBusy(true);
    setActionError("");
    try {
      // These checks spare the member a round trip; the API is what actually enforces them.
      const fresh = await freebusRequest<ApiTrip>(`trips/${pending.id}`);
      const currentRoute = await freebusRequest<ApiRoute>(`routes/${fresh.route_id}`);
      if (!tripCanBook(fresh, currentRoute)) throw new Error("This journey is no longer open for booking.");
      const mine = await freebusRequest<ApiBooking[]>("bookings/me");
      if (mine.filter(activeBooking).some((b) => b.trip_id === pending.id))
        throw new Error("You already have a seat on this journey.");

      // Also register a ride request for demand tracking.
      const { date: departure_date } = watParts(pending.trip.departure_time);
      await freebusRequest<ApiRideRequest>("ride-requests", {
        method: "POST",
        body: JSON.stringify({ route_id: pending.route_id, departure_date }),
      }).catch(() => {
        // Non-critical: don't block booking if ride-request fails.
      });

      // Refresh just before submission. Never retry a booking automatically after a timeout.
      // Prefer buses whose current_trip_id matches (active/boarding). Fall back to the bus
      // already assigned to the trip (set during scheduling, before current_trip_id is updated).
      const current = await freebusRequest<ApiBus[]>(
        `buses${queryString({ current_trip_id: pending.id })}`,
      );
      let next: ApiBus | undefined = current
        .filter((b) => b.current_trip_id === pending.id && availableCapacity(b) > 0)
        .sort((a, b) => a.license_plate.localeCompare(b.license_plate))[0];

      // Fallback 1: trip has bus_id set but bus hasn't set current_trip_id yet (NotStarted).
      if (!next && fresh.bus_id) {
        const assigned = await freebusRequest<ApiBus>(`buses/${fresh.bus_id}`).catch(() => null);
        if (assigned && assigned.status !== "Maintenance" &&
            Math.max(0, assigned.capacity - assigned.current_passenger_count) > 0) {
          next = assigned;
        }
      }

      // Fallback 2: if trip has no bus_id set yet (or assigned bus is full/unavailable), find any available bus in fleet.
      if (!next) {
        const fleetBuses = await freebusRequest<ApiBus[]>("buses").catch(() => []);
        next = fleetBuses.find(
          (b) => b.status !== "Maintenance" && Math.max(0, b.capacity - b.current_passenger_count) > 0,
        );
      }

      if (!next) throw new Error("The last seat has just gone. Please choose another journey.");
      const booking = await freebusRequest<ApiBooking>("bookings", {
        method: "POST",
        body: JSON.stringify({ bus_id: next.id, route_id: pending.route_id, trip_id: pending.id }),
      });
      setPending(null);
      await refresh();
      toast({ title: `Seat ${booking.seat_number} is yours`, tone: "success" });
      router.push(`/passenger/free-buses/passes/${booking.id}`);
    } catch (error) {
      setActionError(
        `${error instanceof Error ? error.message : "We couldn't confirm this seat."} Check your boarding passes before trying again.`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const next = tickets[0];
  const nextRoute = next ? routesById.get(next.trip_id ?? "") : undefined;
  const nextBus = next ? busesById.get(next.bus_id) : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <PushNotificationBanner />

      {/* The one thing a member with a seat came here to see. */}
      {next ? (
        <Card
          radius="xl"
          className="mb-7 overflow-hidden !bg-forest-900 !p-0 text-white dark:!bg-forest-950"
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:p-6 sm:pb-5">
            <div className="min-w-0">
              <p className="type-micro text-gold-300">Your next journey</p>
              <p className="type-card-title mt-1.5 line-clamp-2">
                {nextRoute?.name ?? "Booked journey"}
              </p>
              {nextRoute ? (
                <p className="type-meta mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-white/70">
                  <span className="truncate">{location(nextRoute.start_point)}</span>
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{location(nextRoute.end_point)}</span>
                </p>
              ) : null}
            </div>
            <StatusChip tone={next.status === "Boarded" ? "active" : "info"}>
              {next.status === "Boarded" ? "On board" : "Confirmed"}
            </StatusChip>
          </div>

          <div className="grid grid-cols-3 gap-px bg-white/10">
            {[
              { label: "Seat", value: String(next.seat_number) },
              { label: "Bus", value: nextBus?.license_plate ?? "—" },
              {
                label: "Departs",
                value: nextRoute ? timeLabel(nextRoute.departure_time) : "—",
              },
            ].map((cell) => (
              <div key={cell.label} className="bg-forest-900 px-4 py-3.5 dark:bg-forest-950">
                <p className="type-micro text-white/55">{cell.label}</p>
                <p className="type-numeric mt-1 break-words text-[1.0625rem] font-semibold leading-tight">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 p-5 pt-4 sm:p-6 sm:pt-5">
            <ButtonLink
              href={`/passenger/free-buses/passes/${next.id}`}
              icon={Ticket}
              className="!bg-gold-400 !text-forest-950 hover:!bg-gold-300"
            >
              View boarding pass
            </ButtonLink>
            {next.status === "Confirmed" && nextBus && busCanBoard(nextBus) ? (
              <Button
                variant="ghost"
                className="!text-white/80 hover:!bg-white/10 hover:!text-white"
                onClick={() => {
                  setActionError("");
                  setCancel(next);
                }}
              >
                Release seat
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {tickets.length > 1 ? (
        <div className="mb-7">
          <p className="type-micro mb-2 text-ink-muted">
            You also have {tickets.length - 1} other {tickets.length === 2 ? "seat" : "seats"}
          </p>
          <div className="flex flex-col gap-2">
            {tickets.slice(1).map((ticket) => {
              const route = routesById.get(ticket.trip_id ?? "");
              return (
                <ButtonLink
                  key={ticket.id}
                  href={`/passenger/free-buses/passes/${ticket.id}`}
                  variant="secondary"
                  className="!justify-start"
                  icon={Ticket}
                >
                  {route?.name ?? "Booked journey"} · Seat {ticket.seat_number}
                </ButtonLink>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Pick a journey */}
      <div className="mb-4">
        <h1 className="type-section-title text-ink">
          {next ? "Book another seat" : "Where are you going?"}
        </h1>
        <p className="type-meta mt-1.5 text-ink-secondary">
          Every seat is free. Pick a departure and the bus is assigned for you.
        </p>
      </div>

      <SegmentedControl
        label="Journey direction"
        className="mb-4"
        value={direction}
        onChange={(value) => {
          setDirection(value);
          setPoint("");
        }}
        options={[
          { value: "Pickup", label: "To service", icon: BusFront },
          { value: "Dropoff", label: "Going home", icon: MapPin },
        ]}
      />

      {stops.length > 1 ? (
        <div
          className="mb-6 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={direction === "Dropoff" ? "Drop-off point" : "Pickup point"}
        >
          {[{ id: "", name: "All stops" }, ...stops].map((stop) => (
            <button
              key={stop.id || "all"}
              type="button"
              onClick={() => setPoint(stop.id)}
              aria-pressed={point === stop.id}
              className={cn(
                "kx-tap shrink-0 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
                point === stop.id
                  ? "border-gold-500 bg-gold-500 text-forest-950"
                  : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
              )}
            >
              {stop.name}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={BusFront}
            size="sm"
            title="No buses on this route yet"
            description={
              direction === "Dropoff"
                ? "Return journeys are published closer to the service. Check back, or look at journeys to service."
                : "Nothing is scheduled here right now. Try the other direction, or check back once the team publishes this week's buses."
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDay).map(([date, dayRoutes]) => (
            <section key={date}>
              <h2 className="type-micro mb-2.5 text-ink-muted">{dayLabel(date)}</h2>
              <div className="space-y-2.5">
                {dayRoutes.map((route) => {
                  const seats = seatsOn(route);
                  const reserved = tickets.some((t) => t.trip_id === route.id);
                  const from = pointsById.get(route.start_point);
                  const to = pointsById.get(route.end_point);
                  return (
                    <Card
                      key={route.id}
                      radius="xl"
                      className="!p-0"
                      interactive={!reserved}
                    >
                      <div className="flex items-stretch">
                        {/* Departure time is the thing being chosen, so it leads. */}
                        <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center border-r border-line bg-surface-nested px-2 py-4">
                          <Clock className="size-3.5 text-ink-muted" aria-hidden />
                          <p className="type-numeric mt-1.5 text-center text-[0.9375rem] font-semibold leading-tight text-ink">
                            {timeLabel(route.departure_time)}
                          </p>
                          <p className="type-micro mt-0.5 text-ink-muted">WAT</p>
                        </div>

                        <div className="min-w-0 flex-1 p-4">
                          <p className="type-body flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium text-ink">
                            <span className="truncate">{from?.name ?? "Pickup"}</span>
                            <ArrowRight className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
                            <span className="truncate">{to?.name ?? "Destination"}</span>
                          </p>
                          {from?.landmark ? (
                            <p className="type-meta mt-1 truncate text-ink-secondary">
                              {from.landmark}
                            </p>
                          ) : null}
                          <p className="type-meta mt-2 inline-flex items-center gap-1.5 text-ink-muted">
                            <Users className="size-3.5" aria-hidden />
                            {seats} {seats === 1 ? "seat" : "seats"} left
                          </p>

                          <Button
                            className="mt-3.5"
                            block
                            size="sm"
                            icon={Ticket}
                            variant={reserved ? "secondary" : "primary"}
                            disabled={reserved}
                            onClick={() => {
                              setActionError("");
                              setPending(route);
                            }}
                          >
                            {reserved ? "Seat already booked" : "Book a free seat"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(pending)}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        title="Confirm your free seat"
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Go back
            </Button>
            <Button loading={busy} onClick={reserve}>
              Book my seat
            </Button>
          </>
        }
      >
        {pending ? (
          <>
            <p className="type-body font-medium text-ink">{pending.name}</p>
            <p className="type-body mt-2 text-ink">
              {location(pending.start_point)} → {location(pending.end_point)}
            </p>
            <p className="type-meta mt-1.5 text-ink-secondary">
              {dayLabel(pending.departure_date)} at {timeLabel(pending.departure_time)} WAT
            </p>
            <p className="type-meta mt-4 text-ink-muted">
              Your seat and bus are assigned automatically. The journey home is booked
              separately.
            </p>
          </>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-4 text-danger-600">
            {actionError}
          </p>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancel)}
        onClose={() => {
          if (!busy) setCancel(null);
        }}
        tone="danger"
        title="Release this seat?"
        description="Your boarding pass stops working straight away and another member can take the seat. You can book again only while seats remain."
        confirmLabel="Yes, release it"
        loading={busy}
        onConfirm={async () => {
          if (!cancel) return;
          setBusy(true);
          try {
            await freebusRequest(`bookings/${cancel.id}`, { method: "DELETE" });
            setCancel(null);
            await refresh();
            toast({ title: "Seat released" });
          } catch (error) {
            toast({
              title: error instanceof Error ? error.message : "Cancellation failed",
              tone: "danger",
            });
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
