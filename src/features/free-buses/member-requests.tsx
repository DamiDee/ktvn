"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, HandHeart, Route as RouteIcon, Users, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { queryString } from "@/lib/freebus-contract";
import { extractArray, watParts } from "@/lib/trips";
import type { ApiPoint, ApiRideRequest, ApiRoute, ApiTrip } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

/** WAT is UTC+01:00 all year, so a WAT calendar day needs no DST handling. */
function watToday(now = new Date()) {
  return new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
}

function dayLabel(date: string) {
  const today = watToday();
  if (date === today) return "Today";
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (date === tomorrow) return "Tomorrow";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * The API counts interest per route and date but records no author, so it cannot
 * tell this member whether they have already asked. This browser remembers, which
 * stops an accidental double count without pretending to be an authority.
 */
const ASKED_KEY = "kr-freebus-asked";

function readAsked(): string[] {
  try {
    const raw = window.localStorage.getItem(ASKED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberAsked(keys: string[]) {
  try {
    window.localStorage.setItem(ASKED_KEY, JSON.stringify(keys.slice(-200)));
  } catch {
    // Private browsing: the guard lapses, the count is still the server's.
  }
}

export function MemberRideRequests() {
  const client = useQueryClient();
  const { toast } = useToast();
  const [date, setDate] = useState(() =>
    new Date(Date.parse(`${watToday()}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
  );
  const [asked, setAsked] = useState<string[]>(() => (typeof window === "undefined" ? [] : readAsked()));
  const [busyRoute, setBusyRoute] = useState("");

  const routes = useLiveQuery<ApiRoute[]>("routes");
  const points = useLiveQuery<ApiPoint[]>("points");
  const trips = useLiveQuery<ApiTrip[]>("trips");
  const requests = useLiveQuery<ApiRideRequest[]>(`ride-requests${queryString({ departure_date: date })}`);

  const error = routes.error ?? points.error;
  const ready = routes.data && points.data;

  const model = useMemo(() => {
    if (!routes.data || !points.data) return null;
    const pointsById = new Map(extractArray<ApiPoint>(points.data).map((p) => [p.id, p]));
    // Only requests for the chosen date count towards that date's demand.
    const demand = new Map<string, number>();
    for (const request of extractArray<ApiRideRequest>(requests.data)) {
      if (request.departure_date !== date) continue;
      demand.set(request.route_id, (demand.get(request.route_id) ?? 0) + request.count);
    }
    // A route already running that day should send the member to book, not ask again.
    const scheduled = new Set(
      extractArray<ApiTrip>(trips.data)
        .filter((trip) => watParts(trip.departure_time).date === date && trip.status === "NotStarted")
        .map((trip) => trip.route_id),
    );
    const list = [...extractArray<ApiRoute>(routes.data)].sort(
      (a, b) => (demand.get(b.id) ?? 0) - (demand.get(a.id) ?? 0) || a.name.localeCompare(b.name),
    );
    return { pointsById, demand, scheduled, list };
  }, [routes.data, points.data, requests.data, trips.data, date]);

  if (error)
    return (
      <>
        <PageHeader eyebrow="Community transport" title="Ask for a route" />
        <ErrorState
          title="We couldn't load the routes"
          description={error.message}
          onRetry={() => void client.invalidateQueries({ queryKey: ["freebus-live"] })}
        />
        {error instanceof FreebusError && error.status === 401 ? (
          <ButtonLink href="/login">Sign in again</ButtonLink>
        ) : null}
      </>
    );
  if (!ready || !model) return <PageLoader message="Loading routes" />;

  const { pointsById, demand, scheduled, list } = model;
  const location = (id: string) => pointsById.get(id)?.name ?? "Location unavailable";
  const key = (routeId: string) => `${routeId}:${date}`;
  const past = date < watToday();

  async function askFor(route: ApiRoute) {
    setBusyRoute(route.id);
    try {
      await freebusRequest<ApiRideRequest>("ride-requests", {
        method: "POST",
        body: JSON.stringify({ route_id: route.id, departure_date: date }),
      });
      const next = [...asked, key(route.id)];
      setAsked(next);
      rememberAsked(next);
      await client.invalidateQueries({ queryKey: ["freebus-live"] });
      toast({
        title: "Thank you — your interest is counted",
        description: `Oversight can see that ${route.name} is wanted on ${dayLabel(date)}.`,
        tone: "success",
      });
    } catch (caught) {
      toast({
        title: caught instanceof Error ? caught.message : "We couldn't record that. Please try again.",
        tone: "danger",
      });
    } finally {
      setBusyRoute("");
    }
  }

  const totalAsked = list.reduce((sum, route) => sum + (demand.get(route.id) ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Community transport"
        title="Ask for a route"
        description="No bus on the route you need? Tell us, and oversight can put one on."
      />

      <Card radius="xl" className="mb-6 !bg-forest-900 text-white dark:!bg-forest-950">
        <div className="flex items-start gap-3">
          <HandHeart className="mt-0.5 size-6 shrink-0 text-gold-300" aria-hidden />
          <div className="min-w-0">
            <p className="type-card-title">How this works</p>
            <p className="type-meta mt-1.5 text-white/70">
              Pick the day you need to travel and tap the routes you would use. Oversight sees how
              many people want each route and assigns buses where the demand is.
            </p>
          </div>
        </div>
      </Card>

      <Card radius="xl" className="mb-5">
        <Input
          label="Which day do you need to travel?"
          type="date"
          value={date}
          min={watToday()}
          onChange={(event) => setDate(event.target.value)}
        />
        <p className="type-meta mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-secondary">
          <CalendarDays className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
          <span>{dayLabel(date)}</span>
          {totalAsked > 0 ? (
            <span className="text-ink-muted">
              · {totalAsked} {totalAsked === 1 ? "person has" : "people have"} asked for a bus this day
            </span>
          ) : null}
        </p>
      </Card>

      {past ? (
        <Card radius="xl">
          <EmptyState
            icon={CalendarDays}
            size="sm"
            title="That day has passed"
            description="Choose today or a day ahead to ask for a bus."
          />
        </Card>
      ) : list.length === 0 ? (
        <Card radius="xl">
          <EmptyState
            icon={RouteIcon}
            size="sm"
            title="No routes published yet"
            description="Once oversight publishes the community routes, you can ask for a bus on any of them."
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {list.map((route) => {
            const count = demand.get(route.id) ?? 0;
            const alreadyAsked = asked.includes(key(route.id));
            const running = scheduled.has(route.id);
            return (
              <li key={route.id}>
                <Card radius="xl" className={cn(running && "bg-surface-nested")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="type-body font-medium text-ink">{route.name}</p>
                      <p className="type-meta mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink-secondary">
                        <span className="truncate">{location(route.start_point)}</span>
                        <ArrowRight className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
                        <span className="truncate">{location(route.end_point)}</span>
                      </p>
                    </div>
                    {count > 0 ? (
                      <div className="shrink-0 text-right">
                        <p className="type-numeric text-xl font-semibold leading-none text-ink">{count}</p>
                        <p className="type-micro mt-0.5 text-ink-muted">
                          {count === 1 ? "person" : "people"}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {running ? (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
                      <StatusChip tone="success">A bus is already running</StatusChip>
                      <ButtonLink href="/passenger/free-buses" size="sm" variant="secondary">
                        Book a seat
                      </ButtonLink>
                    </div>
                  ) : (
                    <div className="mt-3.5 border-t border-line pt-3.5">
                      {alreadyAsked ? (
                        <p className="type-meta inline-flex items-center gap-2 text-forest-700 dark:text-gold-300">
                          <Check className="size-4 shrink-0" aria-hidden />
                          You asked for this route on {dayLabel(date)}.
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          block
                          icon={Users}
                          loading={busyRoute === route.id}
                          disabled={Boolean(busyRoute)}
                          onClick={() => void askFor(route)}
                        >
                          I need this bus
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="type-meta mt-6 text-ink-muted">
        Asking is not a reservation. When oversight puts a bus on the route, it appears under Find a
        bus and you book your seat there.
      </p>
    </div>
  );
}
