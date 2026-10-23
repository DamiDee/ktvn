"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "../domain/format";
import { Bell, CalendarClock, Car, Search, UserRound, LayoutDashboard } from "lucide-react";
import { Card, CardHeader, DataPoint } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/states";
import { DEMO_DRIVERS, DEMO_PLACES, type DemoEstimate } from "./scheduled-trips";
import { DAY, HOUR, localScheduleTime, resolveScheduleTime, validateBookingTime, type ScheduleRole } from "./contract";
import { BookingCard, SCHEDULE_LABEL, scheduleDate, scheduleError, type ScheduleAction } from "./booking-card";
import { getScheduleDemoStore } from "./demo-store";
import type { Place } from "../domain/types";
import { ScheduledRoutePicker } from "./scheduled-route-picker";

const DEMO_ROUTE_PLACES: Place[] = DEMO_PLACES.map((place, index) => ({ ...place, id: place.id ?? `demo-place-${index}`, secondary: place.secondary ?? "Abuja", source: "search" }));

export default function ScheduleDemo({ initialRole }: { initialRole: ScheduleRole }) {
  const [store] = useState(getScheduleDemoStore), state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [role, setRole] = useState(initialRole), [driver, setDriver] = useState(DEMO_DRIVERS[0].id);
  const [pickup, setPickup] = useState<Place | null>(DEMO_ROUTE_PLACES[0]), [destination, setDestination] = useState<Place | null>(DEMO_ROUTE_PLACES[1]);
  const [routePending, setRoutePending] = useState(false);
  const [departure, setDeparture] = useState(() => localScheduleTime(state.now + DAY)), [quote, setQuote] = useState<DemoEstimate | null>(null), [optionId, setOptionId] = useState("go");
  const [filter, setFilter] = useState("ALL"), [mine, setMine] = useState(false), [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState("");
  async function run(work: () => Promise<void>, message: string) {
    if (busy) return; setBusy(true); setFeedback("");
    try { await work(); setFeedback(message); } catch (error) { setFeedback(scheduleError(error)); throw error; } finally { setBusy(false); }
  }
  const click = (work: () => Promise<void>, message: string) => { void run(work, message).catch(() => {}); };
  useEffect(() => {
    let mounted = true;
    void store.initialize().catch((e: unknown) => { if (mounted) setFeedback(scheduleError(e)); });
    const timer = setInterval(() => { void store.tick().catch(() => {}); }, 10_000);
    return () => { mounted = false; clearInterval(timer); };
  }, [store]);
  const trips = [...state.trips].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).filter((trip) =>
    (role !== "driver" || (mine ? trip.driverId === driver : trip.status === "OPEN")) && (filter === "ALL" || trip.status === filter) &&
    `${trip.pickup.name} ${trip.destination.name} ${trip.driverName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const due = state.trips.filter((trip) => trip.status === "RESERVED").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const action = (id: string, value: ScheduleAction) => run(() => value.type === "accept" ? store.accept(id, driver, value.version) : value.type === "release" ? store.release(id, driver, value.reason) : value.type === "cancel" ? store.cancel(id, value.reason) : value.type === "reschedule" ? store.reschedule(id, { scheduledAt: value.scheduledAt, timezone: value.timezone }) : store.complete(id), "Booking updated. Review its current state below.");
  return <div className="space-y-6">
    <Card radius="xl" className="space-y-4">
      <CardHeader eyebrow="Preview" title="Scheduled trips" description="Try the passenger, driver and admin views using sample trips." action={<Badge variant="gold">Local demo</Badge>} />
      <SegmentedControl<ScheduleRole> label="Preview scheduled trips as" value={role} onChange={(view) => { setRole(view); setFilter("ALL"); setFeedback(""); }} options={[{ value: "passenger", label: "Passenger", icon: UserRound }, { value: "driver", label: "Driver", icon: Car }, { value: "admin", label: "Admin", icon: LayoutDashboard }]} />
      <p className="ride-caption">Sample data only. No real trips or notifications are sent. Scheduling stays Coming soon in production.</p>
      <details className="border-t border-line pt-3">
        <summary className="ride-body-sm cursor-pointer font-medium text-ink-secondary">Simulation controls</summary>
        <p className="ride-caption mt-3">Demo time: {scheduleDate(state.now, "Africa/Lagos")} · Africa/Lagos</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button pill size="sm" disabled={busy || !due} onClick={() => due && click(() => store.advance(Date.parse(due.scheduledAt) - 15 * 60_000), "Activation window reached; eligible reservations became live rides.")}>Activate next ride</Button>
          <Button pill size="sm" variant="secondary" disabled={busy} onClick={() => click(() => store.advance(state.now + HOUR), "Demo clock advanced by one hour.")}>Advance 1 hour</Button>
          <Button pill size="sm" variant="secondary" disabled={busy || !due} onClick={() => due && click(() => store.advance(Date.parse(due.scheduledAt) + 11 * 60_000, true), "Busy participants deferred activation until the booking expired.")}>Simulate busy expiry</Button>
          <Button pill size="sm" variant="ghost" disabled={busy} onClick={() => click(store.reset, "Demo reset.")}>Reset demo</Button>
        </div>
      </details>
    </Card>
    {feedback ? <p role="status" className="ride-body-sm rounded-[var(--kx-radius-md)] bg-surface-nested px-4 py-3 text-ink-secondary">{feedback}</p> : null}
    {role === "admin" ? <>
      <Card radius="xl"><div className="grid grid-cols-3 gap-3"><DataPoint label="Open" value={state.trips.filter((t) => t.status === "OPEN").length} /><DataPoint label="Reserved" value={state.trips.filter((t) => t.status === "RESERVED").length} /><DataPoint label="Ride ready" value={state.trips.filter((t) => t.status === "ACTIVATED").length} /></div></Card>
      <p className="ride-caption px-1">This is the same scheduled-trip list with a summary for admin. Names and bookings in this preview are fictional.</p>
    </> : null}
    {role === "passenger" ? <Card radius="xl" className="space-y-5">
      <CardHeader title="Plan your next journey" description="Choose your route and pickup time. Book from one hour to thirty days ahead." />
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); click(async () => {
        if (!pickup || !destination || routePending) throw new Error("Choose and confirm your pickup and destination first.");
        validateBookingTime({ scheduledAt: resolveScheduleTime(departure, "Africa/Lagos"), timezone: "Africa/Lagos" }, state.now);
        setQuote(await store.quote(pickup, destination));
      }, "Review the quote, then confirm your booking."); }}>
        <ScheduledRoutePicker pickup={pickup} destination={destination} suggestions={DEMO_ROUTE_PLACES} disabled={busy} onPendingChange={setRoutePending} onChange={(field, place) => { if (field === "pickup") setPickup(place); else setDestination(place); setQuote(null); }} />
        <Input label="Pickup time" hint="All pickup times are in Africa/Lagos." icon={CalendarClock} type="datetime-local" required min={localScheduleTime(state.now + HOUR)} max={localScheduleTime(state.now + 30 * DAY)} value={departure} onChange={(e) => { setDeparture(e.target.value); setQuote(null); }} />
        <Button type="submit" pill block disabled={!pickup || !destination || routePending} loading={busy} loadingLabel="Getting your quote">Get fare quote</Button>
      </form>
      {quote ? <div className="space-y-4 border-t border-line pt-5">
        <Select label="Ride option" value={optionId} onChange={(e) => setOptionId(e.target.value)} options={quote.options.filter((row) => !row.option.shared).map((row) => ({ value: row.option.id, label: `${row.option.name} · ${formatMoney(row.fare.total)}` }))} />
        <p className="ride-caption">Your fare is locked when you book. You can schedule a private ride even if no driver is available right now. Demo prices are fictional.</p>
        <Button pill block disabled={!pickup || !destination || routePending} loading={busy} loadingLabel="Confirming your trip" onClick={() => click(async () => {
          if (!pickup || !destination || routePending) throw new Error("Confirm your route first.");
          const fresh = await store.quote(pickup, destination);
          const before = quote.options.find((row) => row.option.id === optionId), after = fresh.options.find((row) => row.option.id === optionId);
          if (!before || !after || before.fare.total.amountMinor !== after.fare.total.amountMinor) { setQuote(fresh); throw new Error("The fare changed. Review the new quote before confirming again."); }
          await store.create({ estimateId: fresh.estimateId, optionId, scheduledAt: resolveScheduleTime(departure, "Africa/Lagos"), timezone: "Africa/Lagos" }); setQuote(null);
        }, "Trip booked with a locked fare. Drivers have been notified in the demo.")}>Confirm scheduled trip</Button>
      </div> : null}
    </Card> : null}
    {role === "driver" ? <Card radius="xl" className="space-y-4">
      <CardHeader title="Upcoming opportunities" description="Reserve a journey ahead of time. The first driver to accept gets the trip." />
      <Select label="Preview as" value={driver} onChange={(e) => setDriver(e.target.value)} options={DEMO_DRIVERS.map((person) => ({ value: person.id, label: person.name }))} />
      <SegmentedControl label="Driver schedules" value={mine ? "mine" : "open"} onChange={(value) => { setMine(value === "mine"); setFilter("ALL"); }} options={[{ value: "open", label: "Open requests" }, { value: "mine", label: "My bookings" }]} />
    </Card> : null}
    {role !== "admin" ? <Card radius="xl">
      <CardHeader title="Updates" action={<Bell className="size-4 text-ink-muted" aria-hidden />} />
      <ul className="mt-3 divide-y divide-line" aria-live="polite">{state.notices.filter((n) => n.audience === role).slice(0, 3).map((n) => <li key={n.id} className="ride-body-sm py-3 text-ink-secondary">{n.message}</li>)}</ul>
      {!state.notices.some((n) => n.audience === role) ? <p className="ride-caption mt-3">Updates about your scheduled trips will appear here.</p> : null}
    </Card> : null}
    <section className="space-y-4" aria-label="Scheduled bookings">
      <h2 className="ride-label px-1">{role === "admin" ? "Scheduled trips" : role === "driver" && !mine ? "Open requests" : "Your scheduled trips"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="search" label="Search trips" icon={Search} placeholder="Location or driver" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select label="Status" value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: "ALL", label: "All statuses" }, ...Object.entries(SCHEDULE_LABEL).map(([value, label]) => ({ value, label }))]} />
      </div>
      <ul className={role === "admin" ? "grid items-start gap-4 lg:grid-cols-2" : "space-y-3"}>{trips.map((trip) => <BookingCard key={trip.id} booking={trip} role={role} driverId={driver} now={state.now} demo driverName={trip.driverName} passengerName={trip.passengerName} busy={busy} onAction={(value) => action(trip.id, value)} />)}</ul>
      {!trips.length ? <EmptyState icon={CalendarClock} title="No scheduled trips here yet" description={role === "driver" && !mine ? "New requests will appear here when passengers schedule a trip." : "Try another filter, or plan your next journey above."} /> : null}
    </section>
  </div>;
}
