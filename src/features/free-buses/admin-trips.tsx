"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { RecordsTable } from "@/components/ui/records-table";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/states";
import { useLiveQuery } from "./live-queries";
import { freebusRequest } from "@/services/freebus-api";
import { apiTimestamp, watInputToApiTime, watParts } from "@/lib/trips";
import type { ApiTrip, ApiRoute, ApiBus } from "@/types/freebus-api";

export function AdminTrips({ initialRoute = "", initialDate = "" }: { initialRoute?: string; initialDate?: string }) {
  const trips = useLiveQuery<ApiTrip[]>("trips");
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const buses = useLiveQuery<ApiBus[]>("buses");
  const [editor, setEditor] = useState<ApiTrip | "new" | null>(null);
  const [action, setAction] = useState<{ trip: ApiTrip; kind: "start" | "complete" | "cancel" | "delete" } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); setEditor(null); setAction(null); setNotice("Trip updated. The reusable route is unchanged."); await client.invalidateQueries({ queryKey: ["freebus-live"] }); }
    catch (e) { setError(e instanceof Error ? e.message : "The trip was not saved. Refresh before retrying."); }
    finally { setBusy(false); }
  }
  const loadError = trips.error ?? routes.error ?? buses.error;
  if (loadError) return <ErrorState title="Could not load trips" description={loadError.message} onRetry={() => void client.invalidateQueries({ queryKey: ["freebus-live"] })} />;
  if (!trips.data || !routes.data || !buses.data) return <p role="status">Loading scheduled trips…</p>;
  const routeName = (trip: ApiTrip) => routes.data.find((r) => r.id === trip.route_id)?.name ?? "Route unavailable";
  return <>
    <PageHeader eyebrow="Free Buses · Service planning" title="Trips" description="One reusable route. A new departure whenever you need it." />
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-500/25 bg-gold-500/5 px-5 py-4 text-sm text-ink-secondary"><StatusChip tone="pending">Any travel day</StatusChip><span>Schedule a departure on any day of the week. All times are Abuja (WAT).</span></div>
    {notice ? <p role="status" className="mb-4 text-sm text-ink">{notice}</p> : null}
    <RecordsTable caption="Scheduled departures" rows={trips.data} rowKey={(t) => t.id} searchIn={(t) => `${routeName(t)} ${watParts(t.departure_time).date} ${t.status} ${t.ride_type}`} searchPlaceholder="Search route, date or status" initialSort={{ id: "departure", direction: "desc" }} action={<Button onClick={() => { setError(""); setEditor("new"); }}>Schedule trip</Button>} columns={[
      { id: "route", header: "Route", primary: true, sortBy: routeName, cell: (t) => <span className="font-semibold text-ink">{routeName(t)}</span> },
      { id: "departure", header: "Departure · WAT", secondary: true, sortBy: (t) => t.departure_time, cell: (t) => `${watParts(t.departure_time).date} · ${watParts(t.departure_time).time.slice(0, 5)}` },
      { id: "direction", header: "Journey", meta: true, cell: (t) => t.ride_type === "Dropoff" ? "Going home" : t.ride_type === "Pickup" ? "To service" : "Round trip" },
      { id: "bus", header: "Bus", meta: true, cell: (t) => buses.data.filter((b) => b.current_trip_id === t.id).map((b) => b.license_plate).join(", ") || buses.data.find((b) => b.id === t.bus_id)?.license_plate || "Unassigned" },
      { id: "status", header: "Status", meta: true, cell: (t) => <StatusChip tone={t.status === "NotStarted" ? "pending" : t.status === "InProgress" ? "info" : "neutral"}>{t.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</StatusChip> },
      { id: "actions", header: "Actions", actions: true, align: "end", cell: (t) => <div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="secondary" disabled={t.status !== "NotStarted"} onClick={() => { setError(""); setEditor(t); }}>Edit</Button>{["NotStarted", "InProgress"].includes(t.status) ? <Button size="sm" variant="ghost" onClick={() => { setError(""); setAction({ trip: t, kind: t.status === "NotStarted" ? "start" : "complete" }); }}>{t.status === "NotStarted" ? "Start" : "Complete"}</Button> : null}<details className="relative"><summary className="cursor-pointer rounded-lg px-3 py-2 text-sm text-ink-secondary">More</summary><div className="flex gap-1 py-2"><Button size="sm" variant="ghost" disabled={t.status !== "NotStarted"} onClick={() => { setError(""); setAction({ trip: t, kind: "cancel" }); }}>Cancel</Button><Button size="sm" variant="ghost" className="!text-danger-600" onClick={() => { setError(""); setAction({ trip: t, kind: "delete" }); }}>Delete</Button></div></details></div> },
    ]} />
    {!routes.data.length ? <p className="mt-5 text-ink-secondary">Create a reusable route first. <ButtonLink variant="link" href="/admin/free-buses/routes">Open routes</ButtonLink></p> : null}
    <Modal open={Boolean(editor)} onClose={() => { if (!busy) setEditor(null); }} title={editor === "new" ? "Schedule a trip" : "Edit trip"} size="lg">
      {editor ? <TripForm key={editor === "new" ? "new" : editor.id} trip={editor === "new" ? undefined : editor} initialRoute={initialRoute} initialDate={initialDate} routes={routes.data} buses={buses.data} busy={busy} error={error} save={(body) => run(() => freebusRequest(editor === "new" ? "trips" : `trips/${editor.id}`, { method: editor === "new" ? "POST" : "PATCH", body: JSON.stringify(body) }))} /> : null}
    </Modal>
    <ConfirmDialog open={Boolean(action)} onClose={() => { if (!busy) setAction(null); }} title={action ? `${action.kind[0].toUpperCase()}${action.kind.slice(1)} this trip?` : "Confirm"} description={error || (action ? `${routeName(action.trip)} · ${watParts(action.trip.departure_time).date}. This changes only this departure, not the reusable route. ${action.kind === "delete" ? "Deletion is permanent. The backend may refuse a trip with bookings." : action.kind === "start" ? "Only start after boarding is finished and the bus has left." : "Members will see the updated trip status."}` : "")} tone={action?.kind === "delete" || action?.kind === "cancel" ? "danger" : "default"} loading={busy} onConfirm={async () => { if (action) await run(() => freebusRequest(`trips/${action.trip.id}${action.kind === "delete" ? "" : `/${action.kind}`}`, { method: action.kind === "delete" ? "DELETE" : "PATCH" })); }} />
  </>;
}

function TripForm({ trip, routes, buses, initialRoute, initialDate, busy, error, save }: { trip?: ApiTrip; routes: ApiRoute[]; buses: ApiBus[]; initialRoute: string; initialDate: string; busy: boolean; error: string; save: (body: Record<string, unknown>) => Promise<void> }) {
  const [validation, setValidation] = useState("");
  const departure = trip ? watParts(trip.departure_time) : null;
  const arrival = trip ? watParts(trip.arrival_time) : null;
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setValidation(""); const data = new FormData(event.currentTarget); const v = (name: string) => String(data.get(name) ?? "");
    const departureTime = watInputToApiTime(v("departure")), arrivalTime = watInputToApiTime(v("arrival"));
    if (!departureTime || !arrivalTime) { setValidation("Choose a valid departure and arrival date and time."); return; }
    const leaves = Date.parse(apiTimestamp(departureTime)), arrives = Date.parse(apiTimestamp(arrivalTime));
    if (!Number.isFinite(leaves) || !Number.isFinite(arrives) || leaves <= Date.now() || arrives <= leaves) { setValidation("Choose a future departure and an arrival after departure."); return; }
    const body: Record<string, unknown> = { departure_time: departureTime, arrival_time: arrivalTime, ride_type: v("direction") };
    if (!trip) body.route_id = v("route");
    if (v("bus")) body.bus_id = v("bus");
    else if (trip?.bus_id) { setValidation("To unassign an existing bus, use Buses → Manage → Change / clear trip."); return; }
    await save(body);
  }}>
    <Select label="Reusable route" name="route" required disabled={Boolean(trip)} defaultValue={trip?.route_id ?? initialRoute} options={[{ value: "", label: "Choose a route" }, ...routes.map((r) => ({ value: r.id, label: r.name }))]} />
    <Select label="Journey" name="direction" defaultValue={trip?.ride_type ?? "Pickup"} options={[{ value: "Pickup", label: "To service" }, { value: "Dropoff", label: "Going home" }, { value: "RoundTrip", label: "Round trip" }]} />
    <Input label="Departure (WAT)" name="departure" type="datetime-local" required defaultValue={departure ? `${departure.date}T${departure.time.slice(0, 5)}` : initialDate ? `${initialDate}T07:00` : undefined} />
    <Input label="Expected arrival (WAT)" name="arrival" type="datetime-local" required defaultValue={arrival ? `${arrival.date}T${arrival.time.slice(0, 5)}` : initialDate ? `${initialDate}T08:00` : undefined} />
    <Select label="Assign bus (optional)" name="bus" defaultValue={trip?.bus_id ?? ""} options={[{ value: "", label: "Assign later" }, ...buses.filter((b) => b.id === trip?.bus_id || (!b.current_trip_id && b.status !== "Maintenance")).map((b) => ({ value: b.id, label: b.license_plate }))]} />
    <p className="text-sm text-ink-muted">The route stays available for future schedules. This departure is a separate trip with its own bookings.</p>
    {error || validation ? <p role="alert" className="text-danger-600">{error || validation}</p> : null}<Button type="submit" block loading={busy}>Save trip</Button>
  </form>;
}
