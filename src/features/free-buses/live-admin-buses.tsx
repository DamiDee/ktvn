"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BusFront, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { MapPicker } from "@/components/ui/map-picker";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { broadcastPush } from "@/hooks/use-push-notifications";
import { availableCapacity, queryString } from "@/lib/freebus-contract";
import type { ApiBooking, ApiBus, ApiPoint, ApiRoute, ApiUser } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

type Panel = "route" | "point" | "bus" | "assign" | null;
export function LiveAdminBuses() {
  const [panel, setPanel] = useState<Panel>(null);
  const [manifest, setManifest] = useState("");
  const [depart, setDepart] = useState<ApiBus | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const { toast } = useToast();
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const buses = useLiveQuery<ApiBus[]>("buses");
  const points = useLiveQuery<ApiPoint[]>("points");
  const passengers = useLiveQuery<ApiBooking[]>(`bookings${queryString({ bus_id: manifest })}`, Boolean(manifest));
  const users = useLiveQuery<ApiUser[]>("users", Boolean(manifest));
  const error = routes.error ?? buses.error ?? points.error;
  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });
  if (error) return <><ErrorState title="We couldn't load bus operations" description={error.message} onRetry={() => void refresh()} />{error instanceof FreebusError && error.status === 401 ? <ButtonLink href="/login">Sign in again</ButtonLink> : null}</>;
  if (!routes.data || !buses.data || !points.data) return <PageLoader message="Loading live bus operations" />;
  const pointName = (id: string) => points.data.find((p) => p.id === id)?.name ?? "Location unavailable";
  const open = (next: Panel) => { setActionError(""); setPanel(next); };
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setActionError("");
    try { await action(); await refresh(); toast({ title: success, tone: "success" }); return true; }
    catch (error) { setActionError(error instanceof Error ? error.message : "The change wasn't saved."); await refresh(); return false; }
    finally { setBusy(false); }
  }
  return <>
    <PageHeader eyebrow="Service transportation" title="Free Buses" description="Manage real pickup points, routes, buses and boarding." />
    {notice ? <p role="status" className="mb-5 rounded-xl border border-gold-400 bg-surface p-4 text-ink">{notice}</p> : null}
    <div className="mb-6 flex flex-wrap gap-2"><Button icon={Plus} onClick={() => open("route")}>Schedule buses</Button><Button variant="secondary" onClick={() => open("point")}>Add pickup / drop-off point</Button><Button variant="secondary" onClick={() => open("bus")}>Register bus</Button><Button variant="ghost" onClick={() => open("assign")}>Assign a bus</Button></div>
    <div className="mb-6 grid grid-cols-3 gap-3">{[{ label: "Registered buses", value: buses.data.length }, { label: "Seats available", value: buses.data.filter((b) => b.current_route_id && routes.data.some((r) => r.id === b.current_route_id && r.fare === 0 && !r.is_completed)).reduce((n, b) => n + availableCapacity(b), 0) }, { label: "Free routes", value: routes.data.filter((r) => r.fare === 0 && !r.is_completed).length }].map(({ label, value }) => <Card key={label} className="!p-4"><p className="type-numeric text-3xl font-semibold text-ink">{value}</p><p className="type-meta mt-2 text-ink-secondary">{label}</p></Card>)}</div>
    <div className="grid gap-4 md:grid-cols-2">{routes.data.filter((r) => r.fare === 0).map((route) => <Card key={route.id}>
      <StatusChip tone={route.is_completed ? "neutral" : "active"}>{route.is_completed ? "Completed" : route.ride_type}</StatusChip><h2 className="type-card-title mt-3 text-ink">{route.name}</h2>
      <p className="type-body mt-3 text-ink">{pointName(route.start_point)} → {pointName(route.end_point)}</p><p className="type-meta mt-2 text-ink-secondary">{route.departure_date} · {route.departure_time} WAT</p>
      <p className="type-meta mt-3 text-ink-muted">{buses.data.filter((b) => b.current_route_id === route.id).length} buses assigned</p>
    </Card>)}</div>
    {!routes.data.length ? <EmptyState icon={BusFront} title="No routes published yet" description="Add the community and service-venue points, register buses, then schedule a journey." /> : null}
    <h2 className="type-section-title mb-4 mt-9 text-ink">Fleet and boarding</h2>
    <div className="grid gap-4 md:grid-cols-2">{buses.data.map((bus) => <Card key={bus.id}>
      <div className="flex items-center justify-between gap-3"><h3 className="type-card-title text-ink">{bus.license_plate}</h3><StatusChip tone={bus.state === "Transit" ? "pending" : "neutral"}>{bus.state}</StatusChip></div>
      <p className="type-body mt-3 text-ink">{bus.current_passenger_count} / {bus.capacity} seats occupied</p><p className="type-meta mt-2 text-ink-secondary">{routes.data.find((r) => r.id === bus.current_route_id)?.name ?? "No route assigned"} · {bus.status}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setActionError(""); setManifest(bus.id); }}>View passengers</Button>
        <Button variant="ghost" disabled={!bus.current_route_id || busy || bus.status === "Maintenance" || bus.state === "Transit" || bus.state === "Arrived"} onClick={() => { setActionError(""); setDepart(bus); }}>Mark departed</Button>
      </div>
    </Card>)}</div>

    <Modal open={panel !== null} onClose={() => { if (!busy) setPanel(null); }} title={panel === "route" ? "Schedule free buses" : panel === "point" ? "Add a meeting point" : panel === "bus" ? "Register a bus" : "Assign a bus"} size="lg" className="max-h-[90dvh]">
      {panel ? <OperationsForm key={panel} panel={panel} points={points.data} routes={routes.data} buses={buses.data} busy={busy} error={actionError} onPartialSave={setNotice} onSubmit={async (action, notifyPayload) => { if (await run(action, "Saved to the API")) { setPanel(null); if (notifyPayload) void broadcastPush(notifyPayload); } }} /> : null}
    </Modal>
    <Modal open={Boolean(manifest)} onClose={() => { if (!busy) setManifest(""); }} title="Passenger manifest" description={buses.data.find((b) => b.id === manifest)?.license_plate} size="lg">
      {passengers.error ? <ErrorState title="Couldn't load passengers" description={passengers.error.message} onRetry={() => void passengers.refetch()} /> : passengers.isPending ? <p>Loading passengers…</p> : <div className="space-y-3">{passengers.data?.filter((b) => b.bus_id === manifest).map((booking) => {
        const user = users.data?.find((u) => u.id === booking.user_id);
        return <div key={booking.id} className="rounded-xl border border-line p-3"><p className="type-body text-ink">Seat {booking.seat_number} · {user ? `${user.first_name} ${user.last_name}` : "Member"}</p><p className="type-meta mt-1 break-all text-ink-secondary">{booking.booking_ref} · {booking.status}</p>
          {booking.status === "Confirmed" ? <Button className="mt-2" size="sm" loading={busy} onClick={() => void run(() => freebusRequest(`bookings/${booking.id}/board`, { method: "PATCH" }), "Passenger boarded")}>Confirm boarding</Button> : null}</div>;
      })}{!passengers.data?.length ? <p className="type-meta text-ink-secondary">No passengers booked on this bus.</p> : null}</div>}
      {users.error ? <p className="type-meta mt-3 text-ink-muted">Member names could not be loaded. Booking references remain available.</p> : null}
      {actionError ? <p role="alert" className="mt-3 text-danger-600">{actionError}</p> : null}
    </Modal>
    <ConfirmDialog open={Boolean(depart)} onClose={() => { if (!busy) setDepart(null); }} title="Confirm this bus has departed?" description={`Mark ${depart?.license_plate ?? "this bus"} as in transit only after boarding is complete and the bus has actually left. Members will no longer see its seats as available.`} confirmLabel="Mark departed" loading={busy} onConfirm={async () => {
      if (depart && await run(() => freebusRequest(`buses/${depart.id}/state`, { method: "PATCH", body: JSON.stringify({ state: "Transit" }) }), "Bus marked departed")) {
        const route = routes.data.find((r) => r.id === depart?.current_route_id);
        void broadcastPush({ title: "🚌 Bus has departed", body: route ? `${route.name} is now in transit. Have a safe journey!` : "Your bus has left. Have a safe journey!", url: "/passenger/free-buses", tag: "freebus-departed" });
        setDepart(null);
      } else toast({ title: "Departure could not be confirmed. Refresh and try again.", tone: "danger" });
    }} />
  </>;
}

interface NotifyPayload { title: string; body: string; url?: string; tag?: string; }
function OperationsForm({ panel, points, routes, buses, busy, error, onSubmit, onPartialSave }: {
  panel: Exclude<Panel, null>; points: ApiPoint[]; routes: ApiRoute[]; buses: ApiBus[]; busy: boolean; error: string;
  onSubmit: (action: () => Promise<unknown>, notify?: NotifyPayload) => Promise<void>;
  onPartialSave: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [validation, setValidation] = useState("");
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const availableBuses = buses.filter((b) => !b.current_route_id && b.current_passenger_count === 0 && b.status !== "Maintenance" && b.state !== "Transit");
  const pointOptions = [{ value: "", label: "Choose a location" }, ...points.map((p) => ({ value: p.id, label: p.name }))];
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setValidation("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (panel === "point") {
      const lat = pickedLocation?.lat ?? NaN;
      const long = pickedLocation?.lng ?? NaN;
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(long) || long < -180 || long > 180) { setValidation("Tap the map or enter coordinates to select a location."); return; }
      await onSubmit(() => freebusRequest("points", { method: "POST", body: JSON.stringify({ name: value("name"), landmark: value("landmark"), description: value("description"), geo_location: { lat: String(lat), long: String(long) } }) }));
    } else if (panel === "bus") {
      await onSubmit(() => freebusRequest("buses", { method: "POST", body: JSON.stringify({ license_plate: value("plate"), capacity: Number(value("capacity")), state: "Stationary", status: "Available" }) }));
    } else if (panel === "assign") {
      await onSubmit(() => freebusRequest(`buses/${value("bus")}/assign-route`, { method: "POST", body: JSON.stringify({ route_id: value("route") }) }));
    } else {
      if (value("start") === value("end")) { setValidation("Pickup and destination must be different locations."); return; }
      if (!selected.length) { setValidation("Select at least one registered bus. Add buses to the fleet first if needed."); return; }
      const departure = Date.parse(`${value("date")}T${value("time")}:00+01:00`);
      if (!Number.isFinite(departure) || departure <= Date.now()) { setValidation("Choose a future departure time in WAT."); return; }
      const routeName = `${value("service")} \u00b7 ${value("name")}`;
      await onSubmit(async () => {
        const result = await freebusRequest<ApiRoute[]>("routes", { method: "POST", body: JSON.stringify({
          name: routeName, description: value("description"), start_point: value("start"), end_point: value("end"),
          fare: 0, distance: Number(value("distance")), ride_type: value("direction"), stops: [], departure_date: value("date"), departure_time: `${value("time")}:00`, is_round_trip: false,
        }) });
        const route = result[0];
        if (!route?.id) throw new Error("The route response was unexpected. Refresh before creating another route.");
        const assignments = await Promise.allSettled(selected.map((id) => freebusRequest(`buses/${id}/assign-route`, { method: "POST", body: JSON.stringify({ route_id: route.id }) })));
        const failed = assignments.filter((r) => r.status === "rejected").length;
        if (failed) onPartialSave(`Route saved, but ${failed} bus assignments failed. Use \u201cAssign a bus\u201d to finish; do not recreate the route.`);
        return route;
      }, { title: "\ud83d\ude8c New free bus available!", body: `${routeName} \u2013 ${value("date")} at ${value("time")} WAT. Book your seat now.`, url: "/passenger/free-buses", tag: "freebus-new-route" });
    }
  }}>
    {panel === "point" ? <>
      <Input label="Location name" name="name" required placeholder="Lugbe Police Signpost" value={locationName} onChange={(e) => setLocationName(e.target.value)} hint="Auto-filled when you select a place on the map below" />
      <Input label="Meeting landmark" name="landmark" required /><Input label="Directions" name="description" required />
      <MapPicker value={pickedLocation} onChange={setPickedLocation} onPlaceSelect={(place) => { if (!locationName) setLocationName(place.name); }} />
    </> : panel === "bus" ? <><Input label="Registration plate" name="plate" required /><Input label="Passenger seats" name="capacity" type="number" min={1} max={100} step={1} defaultValue={18} required /></> : panel === "assign" ? <>
      <Select label="Unassigned bus" name="bus" required options={[{ value: "", label: "Choose a bus" }, ...availableBuses.map((b) => ({ value: b.id, label: `${b.license_plate} · ${b.capacity} seats` }))]} />
      <Select label="Free route" name="route" required options={[{ value: "", label: "Choose a route" }, ...routes.filter((r) => r.fare === 0 && !r.is_completed).map((r) => ({ value: r.id, label: `${r.name} · ${r.departure_date}` }))]} />
    </> : <>
      <Select label="Church service" name="service" options={[{ value: "Koinonia Sunday Service", label: "Koinonia Sunday Service" }, { value: "T.G.A", label: "T.G.A (The General Assembly)" }]} />
      <Input label="Route label" name="name" placeholder="Lugbe to service" required /><Input label="Boarding instructions" name="description" required />
      <Select label="Direction" name="direction" options={[{ value: "Pickup", label: "To service" }, { value: "Dropoff", label: "Going home" }]} />
      <Select label="Boarding location" name="start" required options={pointOptions} /><Select label="Destination" name="end" required options={pointOptions} />
      <div className="grid grid-cols-2 gap-3"><Input label="Departure date" name="date" type="date" required /><Input label="Departure time (WAT)" name="time" type="time" required /></div>
      <Input label="Route distance (km)" name="distance" type="number" min={0.1} step="any" required />
      <fieldset className="rounded-xl border border-line p-4"><legend className="type-meta px-2 font-medium text-ink">Buses available · {selected.length} selected</legend>
        {!availableBuses.length ? <p className="type-meta text-ink-muted">Register an unassigned bus before scheduling.</p> : availableBuses.map((bus) => <label key={bus.id} className="flex min-h-11 items-center gap-3 text-ink"><input type="checkbox" checked={selected.includes(bus.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, bus.id] : ids.filter((id) => id !== bus.id))} />{bus.license_plate} · {bus.capacity} seats</label>)}
      </fieldset><p className="type-meta text-ink-muted">Schedule the return separately so its drop-off point can differ. All routes created here have a zero fare.</p>
    </>}
    {validation || error ? <p role="alert" className="text-danger-600">{validation || error}</p> : null}
    <Button block type="submit" loading={busy} loadingLabel="Saving to API">{panel === "route" ? "Publish schedule" : "Save"}</Button>
  </form>;
}
