"use client";

import { useState } from "react";
import { BellRing, BusFront, ChevronRight, Plus, Ticket, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { useMounted } from "@/hooks/use-media-query";
import { useSessionStore } from "@/stores/session-store";
import { freeBusService } from "@/services/free-bus-service";
import { ADMIN_USER } from "@/mocks/people";
import { allocationAvailability, busBookings, DIRECTION_NAMES, SERVICE_NAMES } from "@/lib/free-buses";
import type { BusActor } from "@/types/free-buses";
import { cn } from "@/lib/cn";
import { useFreeBuses } from "./use-free-buses";
import { ScheduleBusesForm } from "./schedule-buses-form";
import { busDate, busTime, RouteEndpoints } from "./bus-components";

export function AdminFreeBuses() {
  const mounted = useMounted();
  const role = useSessionStore((s) => s.role);
  const allowed = mounted && role === "ADMIN";
  const { data: state, isLoading, error, refetch } = useFreeBuses(allowed);
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [eventFilter, setEventFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [manifestId, setManifestId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addCount, setAddCount] = useState("1");
  const [addCapacity, setAddCapacity] = useState("18");
  const [addModel, setAddModel] = useState("Toyota Hiace");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const actor: BusActor = { id: ADMIN_USER.id, name: ADMIN_USER.fullName, role };

  if (!mounted) return <PageLoader message="Preparing Free Buses" />;
  if (!allowed) return <EmptyState icon={BusFront} title="Sign in to manage Free Buses" description="Bus scheduling is available to the oversight team." action={<ButtonLink href="/login">Sign in as oversight</ButtonLink>} />;
  if (error) return <ErrorState title="We couldn't load bus operations" description={error.message} onRetry={() => void refetch()} />;
  if (isLoading || !state) return <PageLoader message="Loading bus schedules" />;

  const routes = state.allocations.filter((route) => (eventFilter === "ALL" || route.eventId === eventFilter) && (directionFilter === "ALL" || route.direction === directionFilter));
  const totals = routes.reduce((sum, route) => {
    const available = allocationAvailability(state, route);
    return { ground: sum.ground + available.remaining, departed: sum.departed + available.departed, seats: sum.seats + available.seats };
  }, { ground: 0, departed: 0, seats: 0 });
  const manifest = state.allocations.find((route) => route.id === manifestId);

  async function runAction(action: () => Promise<unknown>, title: string) {
    setBusy(true); setActionError("");
    try { await action(); await refetch(); toast({ title, tone: "success" }); return true; }
    catch (error) { setActionError(error instanceof Error ? error.message : "This change wasn't saved. Try again."); return false; }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Service transportation" title="Free Buses" description="Schedule the fleet. Watch the seats. Keep members moving." action={<Button icon={Plus} size="lg" pill onClick={() => setScheduleOpen(true)}>Schedule buses</Button>} />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[{ label: "Buses on ground", value: totals.ground, icon: BusFront }, { label: "Seats available", value: totals.seats, icon: Ticket }, { label: "Buses departed", value: totals.departed, icon: ChevronRight }].map(({ label, value, icon: Icon }) => <Card key={label} radius="xl" className="!p-4 sm:!p-5"><Icon className="size-5 text-forest-700 dark:text-gold-300" aria-hidden /><p className="type-numeric mt-3 text-3xl font-semibold text-ink">{value}</p><p className="type-meta mt-1 text-ink-muted">{label}</p></Card>)}
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Select label="Service" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} options={[{ value: "ALL", label: "All service schedules" }, ...state.events.map((event) => ({ value: event.id, label: `${SERVICE_NAMES[event.service]} · ${busDate(event.date)}` }))]} />
        <Select label="Direction" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} options={[{ value: "ALL", label: "Both directions" }, ...Object.entries(DIRECTION_NAMES).map(([value, label]) => ({ value, label }))]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {routes.map((route) => {
          const event = state.events.find((item) => item.id === route.eventId)!;
          const availability = allocationAvailability(state, route);
          return <Card key={route.id} radius="xl">
            <CardHeader eyebrow={`${busDate(event.date)} · ${DIRECTION_NAMES[route.direction]}`} title={SERVICE_NAMES[event.service]} action={<StatusChip tone={availability.remaining ? "active" : "neutral"}>{availability.remaining} / {availability.total} on ground</StatusChip>} />
            <div className="my-5"><RouteEndpoints route={route} event={event} /></div>
            <p className="type-meta text-ink-muted">Boarding {busDate(route.boardingAt)} · {busTime(route.boardingAt)} WAT</p>
            <div className="mt-4 space-y-2">{route.buses.map((bus) => {
              const occupied = busBookings(state, bus.id).length;
              return <div key={bus.id} className={cn("rounded-[var(--kx-radius-sm)] border border-line p-3", bus.departedAt && "bg-surface-nested opacity-60")}>
                <div className="flex items-center justify-between gap-3"><p className="type-meta font-semibold text-ink">{bus.label} <span className="font-normal text-ink-muted">· {bus.model}</span></p><span className="type-micro shrink-0 text-ink-secondary">{bus.departedAt ? "Departed" : `${occupied} / ${bus.capacity} booked`}</span></div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-nested" role="progressbar" aria-label={`${bus.label} seats booked`} aria-valuenow={occupied} aria-valuemin={0} aria-valuemax={bus.capacity}><div className={cn("h-full rounded-full", bus.departedAt ? "bg-ink-muted" : "bg-forest-500 dark:bg-gold-400")} style={{ width: `${occupied / bus.capacity * 100}%` }} /></div>
              </div>;
            })}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" icon={Users} onClick={() => { setActionError(""); setManifestId(route.id); }}>View passengers</Button>
              <Button variant="ghost" icon={Plus} disabled={route.buses.length >= 30} onClick={() => { setActionError(""); setAddingId(route.id); setAddCount("1"); setAddCapacity(String(route.buses[0]?.capacity ?? 18)); setAddModel(route.buses[0]?.model ?? "Toyota Hiace"); }}>Add buses</Button>
            </div>
          </Card>;
        })}
      </div>
      {!routes.length ? <EmptyState icon={BusFront} title="No allocations for this selection" description="Add the first pickup or drop-off route for this service." action={<Button onClick={() => setScheduleOpen(true)} icon={Plus}>Schedule buses</Button>} /> : null}

      {state.notices.length ? <Card radius="xl" className="mt-6"><CardHeader title="Broadcast updates" description="These notices appear for all members and the oversight team." action={<BellRing className="size-5 text-ink-muted" />} /><ul className="mt-4 divide-y divide-line">{state.notices.slice(0, 5).map((notice) => <li key={notice.id} className="py-3"><p className="type-meta font-semibold text-ink">{notice.title}</p><p className="type-meta mt-1 text-ink-secondary">{notice.body}</p></li>)}</ul></Card> : null}

      <Modal open={scheduleOpen} onClose={() => { if (!scheduleBusy) setScheduleOpen(false); }} title="Schedule free buses" description="Create a pickup or drop-off allocation for a specific service." size="lg" className="max-h-[90dvh]">
        {scheduleOpen ? <ScheduleBusesForm events={state.events} actor={actor} onBusyChange={setScheduleBusy} onSaved={() => { setScheduleOpen(false); void refetch(); toast({ title: "Bus schedule published", description: "Members can now reserve seats.", tone: "success" }); }} /> : null}
      </Modal>

      <Modal open={Boolean(manifest)} onClose={() => { if (!busy) setManifestId(null); }} title={manifest ? `${manifest.communityPoint} · Passengers` : "Passengers"} description={manifest ? DIRECTION_NAMES[manifest.direction] : undefined} size="lg" className="max-h-[90dvh]">
        {manifest ? <div className="space-y-5">{manifest.buses.map((bus) => {
          const bookings = busBookings(state, bus.id).sort((a, b) => a.seatNumber - b.seatNumber);
          return <section key={bus.id}><h3 className="type-card-title mb-2 text-ink">{bus.label} · {bookings.length}/{bus.capacity} <span className="type-meta font-normal text-ink-muted">{bus.departedAt ? "Departed" : "Boarding"}</span></h3>{bookings.length ? <ol className="divide-y divide-line rounded-[var(--kx-radius-md)] border border-line px-3">{bookings.map((booking) => <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="type-meta font-medium text-ink">{booking.memberName}</p><p className="type-micro break-all text-ink-muted">{booking.reference}</p></div><span className="type-meta shrink-0 text-ink-secondary">Seat {booking.seatNumber}</span></li>)}</ol> : <p className="type-meta text-ink-muted">No seats booked yet.</p>}</section>;
        })}
        <details className="rounded-[var(--kx-radius-md)] border border-dashed border-line-strong p-4"><summary className="type-meta cursor-pointer font-medium text-ink">Demo: simulate member bookings</summary><p className="type-meta mt-2 text-ink-muted">Fill the next bus with demo members to test its departure, remaining buses and broadcast notification.</p><Button className="mt-3" size="sm" variant="secondary" loading={busy} disabled={!allocationAvailability(state, manifest).remaining} onClick={() => void runAction(() => freeBusService.fillNext(manifest.id, actor), "Bus filled and departure broadcast")}>Fill next bus</Button></details>
        {actionError ? <p role="alert" className="type-meta text-danger-600 dark:text-red-300">{actionError}</p> : null}</div> : null}
      </Modal>

      <Modal open={Boolean(addingId)} onClose={() => { if (!busy) setAddingId(null); }} title="Add buses to this route" description="Existing bus assignments stay in place. New buses open for booking immediately." size="sm">
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!addingId) return; if (await runAction(() => freeBusService.addBuses(addingId, Number(addCount), Number(addCapacity), addModel, actor), "More buses are available")) setAddingId(null); }}>
          <Input label="Additional buses" type="number" min={1} max={30} step={1} value={addCount} onChange={(e) => setAddCount(e.target.value)} required />
          <Input label="Passenger seats per bus" type="number" min={1} max={60} step={1} value={addCapacity} onChange={(e) => setAddCapacity(e.target.value)} required />
          <Input label="Bus model" value={addModel} onChange={(e) => setAddModel(e.target.value)} required />
          {actionError ? <p role="alert" className="type-meta text-danger-600 dark:text-red-300">{actionError}</p> : null}
          <Button type="submit" block loading={busy} loadingLabel="Adding buses">Add buses</Button>
        </form>
      </Modal>
    </div>
  );
}
