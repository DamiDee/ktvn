"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { freebusRequest } from "@/services/freebus-api";
import { canRequestScheduledTrip, scheduledJourneys, tripCanBook, type ScheduledJourney } from "@/lib/trips";
import { journeyTypeLabel } from "@/lib/journey-experience";
import type { ApiRoute, ApiTrip } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";
import { useLiveUser } from "./live-shell";

function readAsked(userId: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(`kr-freebus-asked:v2:${userId}`) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

/** The API aggregates requests by route/day, not passenger or trip ID. */
export function MemberRideRequests() {
  const user = useLiveUser();
  const client = useQueryClient();
  const { toast } = useToast();
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const trips = useLiveQuery<ApiTrip[]>("trips");
  const [dateChoice, setDateChoice] = useState("");
  const [asked, setAsked] = useState(() => readAsked(user.id));
  const [busy, setBusy] = useState("");
  const journeys = scheduledJourneys(routes.data, trips.data)
    .filter((journey) => tripCanBook(journey.trip, { ...journey, id: journey.route_id }))
    .sort((a, b) => a.trip.departure_time.localeCompare(b.trip.departure_time));
  const dates = [...new Set(journeys.map((journey) => journey.departure_date))];
  const date = dates.includes(dateChoice) ? dateChoice : dates[0] ?? "";
  const visible = journeys.filter((journey) => journey.departure_date === date);
  const error = routes.error ?? trips.error;
  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });
  const requestKey = (routeId: string) => `${routeId}:${date}`;

  async function request(journey: ScheduledJourney) {
    if (busy || asked.includes(requestKey(journey.route_id))) return;
    setBusy(journey.id);
    try {
      // Do not send an arbitrary date or silently switch a rescheduled departure.
      const fresh = await freebusRequest<ApiTrip>(`trips/${journey.id}`);
      const route = await freebusRequest<ApiRoute>(`routes/${journey.route_id}`);
      if (!canRequestScheduledTrip(fresh, route, date) || fresh.departure_time !== journey.trip.departure_time) {
        throw new Error("This departure has changed or is no longer scheduled. Choose an updated departure.");
      }
      await freebusRequest("ride-requests", {
        method: "POST",
        body: JSON.stringify({ route_id: route.id, departure_date: date, count: 1 }),
      });
      const next = [...asked, requestKey(route.id)].slice(-200);
      setAsked(next);
      try { window.localStorage.setItem(`kr-freebus-asked:v2:${user.id}`, JSON.stringify(next)); } catch { /* In-memory duplicate guard remains. */ }
      toast({ title: "Your request is recorded", description: "This is not a seat reservation. Book a seat when space is available.", tone: "success" });
    } catch (caught) {
      toast({ title: caught instanceof Error ? caught.message : "Could not confirm your request. Check with the team before retrying.", tone: "danger" });
    } finally {
      await refresh();
      setBusy("");
    }
  }

  if (error) return <ErrorState title="Could not load scheduled departures" description={error.message} onRetry={() => void refresh()} />;
  if (routes.isPending || trips.isPending) return <PageLoader message="Finding scheduled travel days" />;

  return <div className="mx-auto max-w-3xl">
    <PageHeader eyebrow="Free Buses" title="Request a scheduled trip" description="Choose a published departure. Only dates already scheduled by the team are available." />
    {dates.length ? <>
      <Card radius="xl" className="mb-5">
        <Select label="Scheduled travel day · Abuja time" value={date} onChange={(event) => setDateChoice(event.target.value)} disabled={Boolean(busy)} options={dates.map((value) => ({
          value,
          label: new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        }))} />
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">You can request ahead of travel day. Requests count interest for that route and day; they do not issue a boarding pass.</p>
      </Card>
      <ul className="space-y-3">{visible.map((journey) => {
        const done = asked.includes(requestKey(journey.route_id));
        return <li key={journey.id}><Card radius="xl">
          <p className="text-xs font-semibold text-gold-800 dark:text-gold-300">{journeyTypeLabel(journey.ride_type)} · {journey.departure_time.slice(0, 5)} WAT</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">{journey.name}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {done ? <p role="status" className="flex items-center gap-2 text-sm text-ink"><Check className="size-4 text-gold-700" aria-hidden />Request recorded for this route and day</p> : <Button size="sm" loading={busy === journey.id} disabled={Boolean(busy)} onClick={() => void request(journey)}>Request this departure</Button>}
            <ButtonLink size="sm" variant="secondary" href="/passenger/free-buses">Find available seats</ButtonLink>
          </div>
        </Card></li>;
      })}</ul>
    </> : <Card><EmptyState icon={CalendarDays} title="No upcoming departures scheduled" description="The team must schedule a departure before you can request it. Check back when the next service is published." /></Card>}
    <p className="mt-5 text-xs leading-relaxed text-ink-muted">Your recent requests are remembered on this browser to help prevent duplicate submissions. Only a confirmed boarding pass reserves your seat.</p>
  </div>;
}
