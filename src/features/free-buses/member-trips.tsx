"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BusFront, CheckCircle2, CalendarClock, MapPin, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatsCard } from "@/components/ui/stats-card";
import { BarChart } from "@/components/analytics/bar-chart";
import { PageLoader } from "@/components/ui/route-loader";
import { FreebusError } from "@/services/freebus-api";
import { activeBooking } from "@/lib/freebus-contract";
import type { ApiBooking, ApiBus, ApiPoint, ApiRoute } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

const STATUS_TONE = {
  Boarded: "active",
  Confirmed: "info",
  Cancelled: "neutral",
  Revoked: "neutral",
} as const;

const STATUS_LABEL = {
  Boarded: "Travelled",
  Confirmed: "Upcoming",
  Cancelled: "Released",
  Revoked: "Withdrawn",
} as const;

/** The last six calendar months, oldest first, as YYYY-MM keys with short labels. */
function recentMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-GB", { month: "short" }),
    };
  });
}

export function MemberTrips() {
  const client = useQueryClient();
  const bookings = useLiveQuery<ApiBooking[]>("bookings/me");
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const buses = useLiveQuery<ApiBus[]>("buses");
  const points = useLiveQuery<ApiPoint[]>("points");

  const error = bookings.error ?? routes.error ?? buses.error ?? points.error;
  const ready = bookings.data && routes.data && buses.data && points.data;

  const model = useMemo(() => {
    if (!bookings.data || !routes.data || !points.data) return null;
    const routesById = new Map(routes.data.map((route) => [route.id, route]));
    const pointsById = new Map(points.data.map((point) => [point.id, point]));

    const history = [...bookings.data].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const travelled = history.filter((booking) => booking.status === "Boarded");
    const upcoming = history.filter((booking) => booking.status === "Confirmed");
    const released = history.filter(
      (booking) => booking.status === "Cancelled" || booking.status === "Revoked",
    );

    // Which stop this member actually uses, counted over every booking they kept.
    const stopCounts = new Map<string, number>();
    for (const booking of history.filter(activeBooking)) {
      const route = routesById.get(booking.route_id);
      if (!route) continue;
      const stop = route.ride_type === "Dropoff" ? route.end_point : route.start_point;
      stopCounts.set(stop, (stopCounts.get(stop) ?? 0) + 1);
    }
    const favourite = [...stopCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    // Journeys per month, split by direction: hue for outbound, neutral for the way home.
    const months = recentMonths();
    const series = months.map(({ key, label }) => {
      const inMonth = history.filter(
        (booking) => activeBooking(booking) && booking.created_at.slice(0, 7) === key,
      );
      const home = inMonth.filter(
        (booking) => routesById.get(booking.route_id)?.ride_type === "Dropoff",
      ).length;
      return { label, value: inMonth.length - home, secondary: home };
    });
    const charted = series.some((month) => month.value + (month.secondary ?? 0) > 0);

    const toService = history.filter(
      (booking) =>
        activeBooking(booking) && routesById.get(booking.route_id)?.ride_type !== "Dropoff",
    ).length;
    const goingHome = history.filter(
      (booking) =>
        activeBooking(booking) && routesById.get(booking.route_id)?.ride_type === "Dropoff",
    ).length;

    return {
      routesById,
      pointsById,
      history,
      travelled,
      upcoming,
      released,
      favourite: favourite ? (pointsById.get(favourite[0])?.name ?? null) : null,
      favouriteCount: favourite?.[1] ?? 0,
      series,
      charted,
      toService,
      goingHome,
    };
  }, [bookings.data, routes.data, points.data]);

  if (error)
    return (
      <>
        <ErrorState
          title="We couldn't load your journeys"
          description={error.message}
          onRetry={() => void client.invalidateQueries({ queryKey: ["freebus-live"] })}
        />
        {error instanceof FreebusError && error.status === 401 ? (
          <ButtonLink href="/login">Sign in again</ButtonLink>
        ) : null}
      </>
    );
  if (!ready || !model) return <PageLoader message="Gathering your journeys" />;

  const busesById = new Map(buses.data!.map((bus) => [bus.id, bus]));
  const {
    routesById,
    pointsById,
    history,
    travelled,
    upcoming,
    released,
    favourite,
    favouriteCount,
    series,
    charted,
    toService,
    goingHome,
  } = model;
  const location = (id: string) => pointsById.get(id)?.name ?? "Location unavailable";

  if (history.length === 0)
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="type-section-title text-ink">My journeys</h1>
        <Card radius="xl" className="mt-5">
          <EmptyState
            icon={BusFront}
            title="No journeys yet"
            description="Once you book your first free seat, everywhere you've travelled with the community shows up here."
            action={<ButtonLink href="/passenger/free-buses">Find a bus</ButtonLink>}
          />
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      {/* One number, stated plainly, is the headline — not a chart. */}
      <Card radius="xl" className="!bg-forest-900 text-white dark:!bg-forest-950">
        <p className="type-micro text-gold-300">Travelling together</p>
        <p className="mt-2 text-[2.25rem] font-semibold leading-none">
          <span className="type-numeric">{travelled.length}</span>{" "}
          <span className="type-card-title font-normal text-white/75">
            {travelled.length === 1 ? "journey" : "journeys"} with the community
          </span>
        </p>
        <p className="type-meta mt-3 text-white/60">
          {toService} to service · {goingHome} home again
          {favourite ? ` · usually from ${favourite}` : ""}
        </p>
      </Card>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatsCard
          label="Journeys taken"
          value={travelled.length}
          numericValue={travelled.length}
          icon={CheckCircle2}
          accent="forest"
          hint="Boarding confirmed by a steward"
        />
        <StatsCard
          label="Seats upcoming"
          value={upcoming.length}
          numericValue={upcoming.length}
          icon={CalendarClock}
          accent="gold"
          hint={upcoming.length ? "Boarding pass ready" : "Nothing booked yet"}
        />
        <StatsCard
          label={favourite ? "Usual stop" : "Seats released"}
          value={favourite ?? released.length}
          icon={MapPin}
          accent="lilac"
          hint={
            favourite
              ? `${favouriteCount} ${favouriteCount === 1 ? "journey" : "journeys"} from here`
              : "Cancelled before departure"
          }
        />
      </div>

      {charted ? (
        <Card radius="xl" className="mt-5">
          <h2 className="type-card-title text-ink">Your last six months</h2>
          <p className="type-meta mt-1.5 mb-5 text-ink-secondary">
            Seats you kept, by the month you booked them.
          </p>
          <BarChart
            data={series}
            accent="forest"
            height={150}
            formatValue={(value) => `${value} ${value === 1 ? "seat" : "seats"}`}
            seriesLabels={["To service", "Going home"]}
            caption="Free Buses seats booked per month, split between journeys to service and journeys home"
          />
        </Card>
      ) : null}

      <h2 className="type-section-title mt-8 mb-3 text-ink">Every journey</h2>
      <div className="space-y-2.5">
        {history.map((booking) => {
          const route = routesById.get(booking.route_id);
          const bus = busesById.get(booking.bus_id);
          const kept = activeBooking(booking);
          return (
            <Card key={booking.id} radius="xl" className={kept ? "" : "opacity-70"}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-body font-medium text-ink">
                    {route?.name ?? "Booked journey"}
                  </p>
                  {route ? (
                    <p className="type-meta mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink-secondary">
                      <span className="truncate">{location(route.start_point)}</span>
                      <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{location(route.end_point)}</span>
                    </p>
                  ) : null}
                </div>
                <StatusChip tone={STATUS_TONE[booking.status]}>
                  {STATUS_LABEL[booking.status]}
                </StatusChip>
              </div>

              <div className="kx-hairline my-3.5" role="presentation" />

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[
                  { label: "Date", value: route?.departure_date ?? booking.created_at.slice(0, 10) },
                  { label: "Seat", value: String(booking.seat_number) },
                  { label: "Bus", value: bus?.license_plate ?? "—" },
                  { label: "Reference", value: booking.booking_ref },
                ].map((cell) => (
                  <div key={cell.label} className="min-w-0">
                    <p className="type-micro text-ink-muted">{cell.label}</p>
                    <p className="type-numeric truncate text-[0.875rem] font-medium text-ink">
                      {cell.value}
                    </p>
                  </div>
                ))}
              </div>

              {kept ? (
                <ButtonLink
                  href={`/passenger/free-buses/passes/${booking.id}`}
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  View boarding pass
                </ButtonLink>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
