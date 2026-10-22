"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, CalendarClock, CheckCircle2, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DEMO_DRIVERS, type ScheduleRole, type ScheduledStatus } from "./scheduled-trips";
import { getScheduleDemoStore } from "./demo-store";

const LABEL: Record<ScheduledStatus, string> = { OPEN: "Awaiting a driver", RESERVED: "Driver reserved", MATCHED: "Matched for departure", CANCELLED: "Cancelled" };
const inputClass = "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-3 text-sm text-[var(--text-primary)]";
const dateLabel = (value: string | number) => new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
const localDateTime = (now: number) => new Date(now + 3_600_000).toISOString().slice(0, 16);

export default function ScheduleDemo({ initialRole }: { initialRole: ScheduleRole }) {
  const [store] = useState(getScheduleDemoStore);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [role, setRole] = useState(initialRole);
  const [driver, setDriver] = useState(DEMO_DRIVERS[0].id);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState(() => localDateTime(state.now + 86_400_000));
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function act(work: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setFeedback("");
    try { await work(); setFeedback(success); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "That did not save. Try again."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let mounted = true;
    void store.initialize().catch((error: unknown) => { if (mounted) setFeedback(error instanceof Error ? error.message : "Demo storage is unavailable."); });
    const timer = setInterval(() => { void store.tick().catch(() => {}); }, 10_000);
    return () => { mounted = false; clearInterval(timer); };
  }, [store]);

  const trips = [...state.trips].sort((a, b) => a.departureAt.localeCompare(b.departureAt)).filter((trip) =>
    (filter === "ALL" || trip.status === filter) && `${trip.pickup} ${trip.destination} ${trip.driverName ?? ""} ${trip.passengerName}`.toLowerCase().includes(search.toLowerCase()));
  const due = state.trips.filter((trip) => trip.status === "RESERVED").sort((a, b) => a.departureAt.localeCompare(b.departureAt))[0];
  const notices = state.notices.filter((notice) => notice.audience === role).slice(0, 5);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="text-sm font-semibold">Local scheduling demo</p>
      <p className="mt-1 text-xs leading-relaxed">Fictional passengers and drivers. No real booking, push notification or payment is created. Production shows Coming soon.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Preview scheduled trips as">
        {(["passenger", "driver", "admin"] as const).map((view) => <button key={view} type="button" aria-pressed={role === view} onClick={() => { setRole(view); setFeedback(""); setFilter("ALL"); }} className={cn("rounded-full border px-4 py-2 text-sm capitalize", role === view ? "border-amber-950 bg-amber-950 text-white" : "border-amber-400")}>{view}</button>)}
      </div>
      <p className="mt-3 text-xs">Demo time: {dateLabel(state.now)} WAT</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={CalendarClock} disabled={busy || !due} onClick={() => due && void act(() => store.advance(Date.parse(due.departureAt)), "Departure time reached. Reserved trips due now are matched.")}>Simulate next departure</Button>
        <Button size="sm" variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => void act(store.reset, "Demo reset with fictional upcoming trips.")}>Reset demo</Button>
      </div>
    </section>

    <div role="status" aria-live="polite" className="text-sm font-medium">{feedback}</div>

    {role === "passenger" ? <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5">
      <h2 className="ride-heading-md">Schedule your trip</h2>
      <p className="ride-caption mt-1">Choose a future departure. The first driver to accept reserves your trip; matching happens at departure time.</p>
      <form className="mt-4 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void act(async () => {
          await store.create({ pickup, destination, departureAt: new Date(`${departure}:00+01:00`).toISOString() });
          setPickup(""); setDestination("");
        }, "Trip scheduled. Drivers have a new request in their demo inbox.");
      }}>
        <label className="block text-sm font-medium">Pickup<input required maxLength={200} placeholder="Where should your driver meet you?" className={`${inputClass} mt-1`} value={pickup} onChange={(event) => setPickup(event.target.value)} /></label>
        <label className="block text-sm font-medium">Destination<input required maxLength={200} placeholder="Where are you going?" className={`${inputClass} mt-1`} value={destination} onChange={(event) => setDestination(event.target.value)} /></label>
        <label className="block text-sm font-medium">Departure date and time · Abuja (WAT)<input type="datetime-local" required min={localDateTime(state.now + 60_000)} className={`${inputClass} mt-1`} value={departure} onChange={(event) => setDeparture(event.target.value)} /></label>
        <Button type="submit" block loading={busy} loadingLabel="Scheduling">Schedule trip</Button>
      </form>
    </section> : null}

    {role === "driver" ? <section className="rounded-2xl bg-[var(--surface-primary)] p-4">
      <label className="block text-sm font-medium">Test driver<select value={driver} onChange={(event) => setDriver(event.target.value)} className={`${inputClass} mt-2`}>{DEMO_DRIVERS.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <p className="ride-caption mt-2">First acceptance wins. Switch drivers or open another local tab to test a competing acceptance.</p>
    </section> : null}

    {role !== "admin" ? <section aria-label="Schedule notifications" className="rounded-2xl bg-[var(--surface-primary)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Bell className="size-4" aria-hidden />Scheduled trip notifications</h2>
      <ul className="mt-3 space-y-2" aria-live="polite" aria-relevant="additions">{notices.length ? notices.map((notice) => <li key={notice.id} className="text-sm text-[var(--text-secondary)]">{notice.message}</li>) : <li className="text-sm text-[var(--text-secondary)]">No new schedule notifications.</li>}</ul>
    </section> : null}

    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="ride-heading-md">{role === "admin" ? "All scheduled trips" : role === "driver" ? "Upcoming requests" : "Your scheduled trips"}</h2><span className="ride-caption">{state.trips.filter((trip) => trip.status === "OPEN").length} open · {state.trips.filter((trip) => trip.status === "RESERVED").length} reserved</span></div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2"><input className={inputClass} type="search" aria-label="Search scheduled trips" placeholder="Search locations or driver" value={search} onChange={(event) => setSearch(event.target.value)} /><select className={inputClass} aria-label="Scheduled trip status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All statuses</option>{Object.entries(LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <ul className="space-y-3">{trips.map((trip) => <li key={trip.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
        <div className="flex items-start justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 shrink-0" aria-hidden />{trip.pickup} → {trip.destination}</p><span className="rounded-full bg-[var(--surface-secondary)] px-2 py-1 text-xs font-semibold">{LABEL[trip.status]}</span></div>
        <p className="mt-3 text-sm">{dateLabel(trip.departureAt)} WAT</p>
        <p className="ride-caption mt-1">Passenger: {trip.passengerName}</p>
        <p className="ride-caption mt-1">{trip.driverName ? `Accepted by ${trip.driverName}${trip.acceptedAt ? ` · ${dateLabel(trip.acceptedAt)} WAT` : ""}` : "No driver has accepted yet."}</p>
        {trip.status === "RESERVED" ? <p className="ride-caption mt-2">Driver reserved. Matching waits until the scheduled departure.</p> : null}
        {trip.status === "MATCHED" ? <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden />Demo match ready. No live ride has been dispatched.</p> : null}
        {role === "driver" && trip.status === "OPEN" ? <Button size="sm" className="mt-3" disabled={busy} onClick={() => void act(() => store.accept(trip.id, driver), "Trip reserved. Admin and passenger views now show the accepting driver.")}>Accept scheduled trip</Button> : null}
        {role === "passenger" && ["OPEN", "RESERVED"].includes(trip.status) ? <Button size="sm" variant="ghost" className="mt-3" disabled={busy} onClick={() => void act(() => store.cancel(trip.id), "Scheduled trip cancelled. Drivers have been notified in the demo.")}>Cancel schedule</Button> : null}
      </li>)}</ul>
      {!trips.length ? <p className="rounded-2xl bg-[var(--surface-primary)] p-6 text-center text-sm">No scheduled trips match this view.</p> : null}
    </section>
  </div>;
}
