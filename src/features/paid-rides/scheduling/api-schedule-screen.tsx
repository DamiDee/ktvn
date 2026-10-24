"use client";
import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PAID_RIDES_MODE } from "../config";
import { getRideService } from "../services";
import { getRealtimeClient } from "../realtime";
import { useRideViewer } from "../hooks/use-ride-viewer";
import type { FareEstimate, Place } from "../domain/types";
import { formatMoney } from "../domain/format";
import { apiScheduleService } from "./api-service";
import { ScheduleApiError } from "./schedule-service";
import { BookingCard, SCHEDULE_LABEL, scheduleError, type ScheduleAction } from "./booking-card";
import { DAY, HOUR, localScheduleTime, preferNewerBooking, resolveScheduleTime, validateBookingTime, type CreateScheduledRide, type ScheduledRide, type ScheduledRidePage, type ScheduledStatus } from "./contract";
import { RouteLoader } from "@/components/ui/route-loader";
import { ScheduledRoutePicker } from "./scheduled-route-picker";

function ApiBookingForm({ onCreated, now }: { onCreated: () => void; now: number }) {
  const [pickup, setPickup] = useState<Place | null>(null), [destination, setDestination] = useState<Place | null>(null);
  const [time, setTime] = useState(() => localScheduleTime(Date.now() + DAY)), [estimate, setEstimate] = useState<FareEstimate | null>(null), [optionId, setOptionId] = useState("");
  const [routePending, setRoutePending] = useState(false);
  const [pending, setPending] = useState<CreateScheduledRide | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  function clearQuote() { setEstimate(null); setOptionId(""); }
  async function quote() {
    if (!pickup || !destination || busy || routePending) return;
    setBusy(true); setMessage("");
    try { validateBookingTime({ scheduledAt: resolveScheduleTime(time, "Africa/Lagos"), timezone: "Africa/Lagos" }, Date.now()); const data = await getRideService().estimateRide({ pickup, destination }); setEstimate(data); setOptionId(data.options.find((o) => !o.shared)?.id ?? ""); }
    catch (e) { setMessage(scheduleError(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (busy || !pickup || !destination || routePending) return;
    setBusy(true); setMessage("");
    try {
      let body = pending;
      if (!body) {
        const scheduledAt = resolveScheduleTime(time, "Africa/Lagos"); validateBookingTime({ scheduledAt, timezone: "Africa/Lagos" }, Date.now());
        const fresh = await getRideService().estimateRide({ pickup, destination });
        const selected = fresh.options.find((o) => o.id === optionId && !o.shared), old = estimate?.options.find((o) => o.id === optionId);
        if (!selected || !old || selected.fare.total.amountMinor !== old.fare.total.amountMinor || selected.fare.total.currency !== old.fare.total.currency) { setEstimate(fresh); setMessage("The fare or option changed. Review the fresh quote and confirm again."); return; }
        body = { estimateId: fresh.estimateId, optionId, scheduledAt, timezone: "Africa/Lagos" }; setPending(body);
      }
      await apiScheduleService.create(body); setPending(null); setEstimate(null); setMessage("Your scheduled trip is confirmed. We’ll update your booking when a driver accepts."); onCreated();
    } catch (e) {
      // An uncertain request may have committed: keep the exact estimate/payload for safe retry.
      if (!(e instanceof ScheduleApiError) || !e.uncertain) setPending(null);
      setMessage(`${scheduleError(e)}${e instanceof ScheduleApiError && e.uncertain ? " Retry the same booking below; do not create a second booking." : ""}`);
    } finally { setBusy(false); }
  }
  return <Card radius="xl" className="space-y-5">
    <CardHeader title="Plan your next journey" description="Choose your route and pickup time. Book from one hour to thirty days ahead." />
    <div className="space-y-4">
      <ScheduledRoutePicker pickup={pickup} destination={destination} disabled={busy || !!pending} onPendingChange={setRoutePending} onChange={(field, place) => { if (field === "pickup") setPickup(place); else setDestination(place); clearQuote(); }} />
      <Input label="Pickup time" hint="All pickup times are in Africa/Lagos." icon={CalendarClock} type="datetime-local" value={time} disabled={busy || !!pending} min={localScheduleTime(now + HOUR)} max={localScheduleTime(now + 30 * DAY)} onChange={(e) => { setTime(e.target.value); clearQuote(); }} />
      <Button pill block disabled={busy || !!pending || routePending || !pickup || !destination} onClick={() => void quote()}>Get fare quote</Button>
    </div>
    {estimate ? <div className="space-y-4 border-t border-line pt-5">
      <Select label="Ride option" value={optionId} disabled={busy || !!pending} onChange={(e) => setOptionId(e.target.value)} options={estimate.options.filter((o) => !o.shared).map((o) => ({ value: o.id, label: `${o.name} · ${formatMoney(o.fare.total)}` }))} />
      <p className="ride-caption">Your fare is locked when you book. You can schedule a private ride even if no driver is available right now.</p>
      <Button pill block loading={busy} loadingLabel="Confirming your trip" disabled={!optionId || routePending} onClick={() => void confirm()}>{pending ? "Retry same booking" : "Confirm scheduled trip"}</Button>
    </div> : null}
    {message ? <p role="status" className="ride-body-sm text-ink-secondary">{message}</p> : null}
  </Card>;
}
function keepVersions(old: unknown, fresh: InfiniteData<ScheduledRidePage, string | null>) {
  const previous = old as InfiniteData<ScheduledRidePage, string | null> | undefined;
  const byId = new Map(previous?.pages.flatMap((page) => page.items).map((booking) => [booking.id, booking]));
  return { ...fresh, pages: fresh.pages.map((page) => ({ ...page, items: page.items.map((booking) => preferNewerBooking(byId.get(booking.id), booking)) })) };
}
function ApiSchedules({ role }: { role: "passenger" | "driver" | "admin" }) {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const update = () => setClock(Date.now());
    const timer = setInterval(update, 60_000); window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const viewer = useRideViewer(), userId = viewer.data?.account?.id, queries = useQueryClient();
  const [mine, setMine] = useState(false), [status, setStatus] = useState<ScheduledStatus | "">(""), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [conflicts, setConflicts] = useState<Set<string>>(new Set());
  let filterError = "";
  const filter = { ...(status ? { status } : {}), limit: 25, ...(role === "driver" ? { mine } : {}) } as { status?: ScheduledStatus; limit: number; mine?: boolean; from?: string; to?: string };
  try {
    if (from) filter.from = resolveScheduleTime(from, "Africa/Lagos");
    if (to) filter.to = resolveScheduleTime(to, "Africa/Lagos");
    if (filter.from && filter.to && Date.parse(filter.from) >= Date.parse(filter.to)) filterError = "Choose an end time after the start time.";
  } catch (e) { filterError = scheduleError(e); }
  const root = ["paid-rides", "schedules", userId, role] as const;
  const list = useInfiniteQuery({ queryKey: [...root, filter], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => (role === "admin" ? apiScheduleService.listAdmin : role === "driver" ? apiScheduleService.listDriver : apiScheduleService.listBookings)({ ...filter, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    enabled: Boolean(userId) && !filterError, getNextPageParam: (page) => page.nextCursor ?? undefined, retry: false,
    structuralSharing: (old, fresh) => keepVersions(old, fresh as InfiniteData<ScheduledRidePage, string | null>),
    refetchInterval: () => document.visibilityState === "visible" ? 10_000 : false, refetchOnWindowFocus: true,
  });
  const bookings = [...new Map(list.data?.pages.flatMap((p) => p.items).map((b) => [b.id, b])).values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const owned = bookings.filter((b) => b.passengerId === userId || b.driverId === userId || role === "driver" && mine);
  const subscriptions = owned.map((b) => b.id).sort().join(","), liveSubscriptions = owned.flatMap((b) => b.status === "ACTIVATED" && b.rideId ? [b.rideId] : []).sort().join(",");
  useEffect(() => {
    if (!userId) return;
    const client = getRealtimeClient();
    const refresh = () => { client.connect(); void queries.invalidateQueries({ queryKey: ["paid-rides", "schedules", userId] }); };
    const focus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", focus);
    const ids = subscriptions ? subscriptions.split(",") : [], rides = liveSubscriptions ? liveSubscriptions.split(",") : [];
    ids.forEach((id) => client?.subscribeToSchedule(id)); rides.forEach((id) => client?.subscribeToRide(id));
    const detach = client?.onScheduledEvent(refresh), reconnect = client?.onReconnected(refresh);
    client?.connect();
    return () => { detach?.(); reconnect?.(); ids.forEach((id) => client?.unsubscribeFromSchedule(id)); rides.forEach((id) => client?.unsubscribeFromRide(id)); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", focus); };
  }, [queries, userId, subscriptions, liveSubscriptions]);
  async function action(booking: ScheduledRide, value: ScheduleAction) {
    if (busy) return; setBusy(true); setMessage("");
    try {
      if (value.type === "reschedule") validateBookingTime({ scheduledAt: value.scheduledAt, timezone: value.timezone }, clock);
      const result = value.type === "assign" ? await apiScheduleService.assign(booking.id, { driverId: value.driverId, version: value.version }) : value.type === "accept" ? await apiScheduleService.accept(booking.id, value.version) : value.type === "release" ? await apiScheduleService.release(booking.id, value.reason) : value.type === "cancel" ? await apiScheduleService.cancelPassenger(booking.id, value.reason) : value.type === "reschedule" ? await apiScheduleService.reschedule(booking.id, { scheduledAt: value.scheduledAt, timezone: value.timezone }) : null;
      if (result) queries.setQueriesData<InfiniteData<ScheduledRidePage, string | null>>({ queryKey: root }, (old) => old ? { ...old, pages: old.pages.map((page) => ({ ...page, items: page.items.map((row) => row.id === result.id ? preferNewerBooking(row, result) : row) })) } : old);
      setMessage("Booking updated. The server confirmed its current state.");
    } catch (e) {
      if (e instanceof ScheduleApiError && e.status === 409) setConflicts((old) => new Set(old).add(booking.id));
      setMessage(`${scheduleError(e)}${e instanceof ScheduleApiError && e.uncertain ? " Check your assigned bookings before trying another action." : ""}`);
      throw e;
    } finally { await queries.invalidateQueries({ queryKey: ["paid-rides", "schedules", userId] }); setBusy(false); }
  }
  if (viewer.isPending) return <RouteLoader message="Loading your scheduled trips" />;
  if (viewer.isError || !userId) return <ErrorState title="We couldn’t load your account" description="Check your connection and sign in again if your session has expired." onRetry={() => void viewer.refetch()} />;
  return <div className="space-y-6">
    <Card radius="xl"><CardHeader title={role === "driver" ? "Plan your upcoming journeys" : "Scheduled trips"} description={role === "passenger" ? "Book ahead, follow driver confirmations, and manage your upcoming journeys." : role === "driver" ? "Accept an upcoming request or manage your reserved trips." : "Review scheduled journeys and their driver assignments."} /></Card>
    {role === "passenger" && userId ? <ApiBookingForm key={userId} now={clock} onCreated={() => { void queries.invalidateQueries({ queryKey: root }); }} /> : null}
    {role === "driver" ? <SegmentedControl label="Driver schedules" value={mine ? "mine" : "open"} onChange={(value) => { setMine(value === "mine"); setStatus(""); }} options={[{ value: "open", label: "Open requests" }, { value: "mine", label: "My bookings" }]} /> : null}
    <section className="space-y-4" aria-label="Scheduled bookings">
      <h2 className="ride-label px-1">{role === "driver" && !mine ? "Open requests" : role === "admin" ? "Scheduled trips" : "Your scheduled trips"}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ScheduledStatus | "")} options={[{ value: "", label: "All statuses" }, ...Object.entries(SCHEDULE_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Input label="From" hint="Africa/Lagos" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Until" hint="Africa/Lagos · end time excluded" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {message ? <p role="status" className="ride-body-sm rounded-[var(--kx-radius-md)] bg-surface-nested px-4 py-3 text-ink-secondary">{message}</p> : null}
      {filterError ? <p role="alert" className="ride-body-sm text-danger-600">{filterError}</p> : list.isPending ? <div className="space-y-3" aria-busy aria-label="Loading scheduled trips">{[0, 1, 2].map((row) => <div key={row} className="kx-skeleton h-52 w-full !rounded-[var(--ride-radius-lg)]" />)}</div> : list.isError ? <ErrorState title="We couldn't load your scheduled trips" description={scheduleError(list.error)} onRetry={() => void list.refetch()} /> : null}
      {!list.isPending && !list.isError && !filterError ? <p className="ride-caption px-1">Showing {bookings.length} of {list.data?.pages[0].total ?? 0} · sorted by pickup time within loaded results</p> : null}
      <ul className="space-y-3">{bookings.map((b) => <BookingCard key={b.id} booking={b} role={role} driverId={userId} viewerId={userId} assignedToViewer={role === "driver" && mine} now={clock} busy={busy} reviewRequired={conflicts.has(b.id)} onReview={() => { setConflicts((old) => { const next = new Set(old); next.delete(b.id); return next; }); }} onAction={(value) => action(b, value)} />)}</ul>
      {!list.isPending && !list.isError && !filterError && !bookings.length ? <EmptyState icon={CalendarClock} title="No scheduled trips here yet" description={role === "driver" && !mine ? "New requests will appear here when passengers schedule a trip." : role === "admin" ? "No scheduled trips were returned for this account. Try another filter." : "Try another filter, or plan your next journey above."} /> : null}
      {list.hasNextPage && !filterError ? <Button pill block variant="secondary" loading={list.isFetchingNextPage} loadingLabel="Loading trips" onClick={() => void list.fetchNextPage()}>Load more bookings</Button> : null}
    </section>
  </div>;
}
export default function ApiScheduleScreen({ role }: { role: "passenger" | "driver" | "admin" }) {
  if (PAID_RIDES_MODE !== "api") return <EmptyState icon={CalendarClock} title="Connect to live rides to schedule a trip" description="Scheduled bookings require a signed-in account and the live rides service." />;
  return <ApiSchedules role={role} />;
}
