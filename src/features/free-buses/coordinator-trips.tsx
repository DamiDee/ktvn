"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, MapPin, PlayCircle, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { freebusRequest } from "@/services/freebus-api";
import { watParts } from "@/lib/trips";
import type { ApiBus, ApiRoute, ApiTrip } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";
import { useTripBookings } from "./use-trip-bookings";

type Pending = { trip: ApiTrip; kind: "start" | "complete" };

/** A coordinator's view of the day: each open trip, who is booked, and one clear action. */
export function CoordinatorTrips() {
  const trips = useLiveQuery<ApiTrip[]>("trips");
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const buses = useLiveQuery<ApiBus[]>("buses");
  const { summary, error: bookingsError } = useTripBookings();
  const client = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadError = trips.error ?? routes.error ?? buses.error;
  if (loadError) return <ErrorState title="Could not load trips" description={loadError.message} onRetry={() => void client.invalidateQueries({ queryKey: ["freebus-live"] })} />;
  if (!trips.data || !routes.data || !buses.data) return <p role="status">Loading trips…</p>;

  const routeName = (trip: ApiTrip) => routes.data.find((r) => r.id === trip.route_id)?.name ?? "Route unavailable";
  const busFor = (trip: ApiTrip) => buses.data.find((b) => b.current_trip_id === trip.id) ?? buses.data.find((b) => b.id === trip.bus_id);
  const open = trips.data
    .filter((t) => t.status === "NotStarted" || t.status === "InProgress")
    .sort((a, b) => (a.status === b.status ? a.departure_time.localeCompare(b.departure_time) : a.status === "InProgress" ? -1 : 1));

  async function confirm() {
    if (!pending) return;
    setBusy(true); setError("");
    try {
      await freebusRequest(`trips/${pending.trip.id}/${pending.kind}`, { method: "PATCH" });
      setNotice(pending.kind === "start" ? "Trip started. Safe journey!" : "Trip completed. Thank you for your service.");
      setPending(null);
      await client.invalidateQueries({ queryKey: ["freebus-live"] });
    } catch (e) { setError(e instanceof Error ? e.message : "The trip was not updated. Refresh before retrying."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="Free Buses · Route Coordinator" title="Trips" description="Start a trip once boarding is finished and the bus has left. Complete it when everyone has arrived." />
    {notice ? <p role="status" className="mb-4 rounded-xl border border-forest-500/30 bg-forest-50 p-4 font-medium text-forest-900 dark:bg-forest-500/12 dark:text-forest-100">{notice}</p> : null}
    {bookingsError ? <p role="alert" className="mb-4 text-sm text-danger-600">Booked counts are unavailable right now: {bookingsError.message}</p> : null}
    {open.length === 0 ? <Card radius="xl"><EmptyState icon={CalendarClock} size="sm" title="No open trips" description="Scheduled and running trips appear here." /></Card> : <div className="grid gap-4 md:grid-cols-2">
      {open.map((trip) => {
        const running = trip.status === "InProgress";
        const bus = busFor(trip);
        const count = summary.get(trip.id);
        const when = watParts(trip.departure_time);
        return <Card key={trip.id} radius="xl" className={`!p-0 overflow-hidden ${running ? "ring-1 ring-gold-500/50" : ""}`}>
          <div className="flex items-start justify-between gap-3 p-5 pb-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{routeName(trip)}</p>
              <p className="type-meta mt-1 flex items-center gap-1.5 text-ink-secondary"><CalendarClock className="size-3.5" aria-hidden />{when.date} · {when.time.slice(0, 5)} WAT</p>
            </div>
            <StatusChip tone={running ? "info" : "pending"}>{running ? "In progress" : "Not started"}</StatusChip>
          </div>
          <div className="grid grid-cols-2 gap-px bg-line">
            <div className="bg-surface px-5 py-3"><p className="type-micro text-ink-muted">Booked</p><p className="type-numeric mt-1 flex items-center gap-1.5 text-xl font-semibold text-ink"><Users className="size-4 text-ink-muted" aria-hidden />{count ? count.people : 0}<span className="text-xs font-normal text-ink-muted">{count ? `${count.boarded} boarded` : "people"}</span></p></div>
            <div className="bg-surface px-5 py-3"><p className="type-micro text-ink-muted">Bus</p><p className="type-numeric mt-1 flex items-center gap-1.5 text-xl font-semibold text-ink"><MapPin className="size-4 text-ink-muted" aria-hidden />{bus?.license_plate ?? "—"}</p></div>
          </div>
          <div className="p-5 pt-4">
            {running
              ? <Button block size="lg" variant="gold" icon={CheckCircle2} onClick={() => { setError(""); setPending({ trip, kind: "complete" }); }}>Complete trip</Button>
              : <Button block size="lg" icon={PlayCircle} onClick={() => { setError(""); setPending({ trip, kind: "start" }); }}>Start trip</Button>}
          </div>
        </Card>;
      })}
    </div>}
    <ConfirmDialog open={Boolean(pending)} onClose={() => { if (!busy) setPending(null); }} title={pending?.kind === "start" ? "Start this trip?" : "Complete this trip?"} description={error || (pending ? `${routeName(pending.trip)} · ${watParts(pending.trip.departure_time).date}. ${pending.kind === "start" ? "Only start after boarding is finished and the bus has left." : "Members will see the trip as completed."}` : "")} confirmLabel={pending?.kind === "start" ? "Start trip" : "Complete trip"} loading={busy} onConfirm={confirm} />
  </>;
}
