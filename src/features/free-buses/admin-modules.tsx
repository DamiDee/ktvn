"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { RecordsTable } from "@/components/ui/records-table";
import { EmptyState } from "@/components/ui/states";
import { BusFront, Route as RouteIcon, MapPin } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { MapPicker } from "@/components/ui/map-picker";
import { freebusRequest } from "@/services/freebus-api";
import { queryString } from "@/lib/freebus-contract";
import { broadcastPush } from "@/hooks/use-push-notifications";
import type { ApiBus, ApiPoint, ApiRoute } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";
import { OperationsForm } from "./live-admin-buses";
import { RouteDistance } from "./route-distance";

type Module = "overview" | "buses" | "routes" | "points";
type Edit = { kind: "bus"; value: ApiBus } | { kind: "route"; value: ApiRoute } | { kind: "point"; value: ApiPoint };
type Action = { title: string; description: string; path: string; method: string; body?: unknown; danger?: boolean; done?: string };
const labels = { overview: "Overview", buses: "Buses", routes: "Routes", points: "Points" };

export function AdminTransportModule({ module = "overview" }: { module?: Module }) {
  const routes = useLiveQuery<ApiRoute[]>("routes");
  const buses = useLiveQuery<ApiBus[]>("buses");
  const points = useLiveQuery<ApiPoint[]>("points");
  const client = useQueryClient();
  const [create, setCreate] = useState<"route" | "bus" | "point" | "assign" | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });
  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true); setError("");
    try { await fn(); await refresh(); setCreate(null); setEdit(null); setAction(null); if (done) setNotice(done); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "The change could not be saved. Refresh before retrying."); await refresh(); return false; }
    finally { setBusy(false); }
  }
  const loadError = routes.error ?? buses.error ?? points.error;
  if (loadError) return <ErrorState title="Could not load transport" description={loadError.message} onRetry={() => void refresh()} />;
  if (!routes.data || !buses.data || !points.data) return <PageLoader message="Loading transport" />;
  const open = (value: typeof create) => { setError(""); setCreate(value); };
  const modify = (value: Edit) => { setError(""); setEdit(value); };
  const confirm = (value: Action) => { setError(""); setAction(value); };
  const pointName = (id: string) => points.data.find((p) => p.id === id)?.name ?? id;
  return <>
    <PageHeader eyebrow="Free Buses · Oversight" title={labels[module]} description={module === "overview" ? "A clear view of today's transport operations." : `Manage ${module} in one dedicated workspace.`} />
    {notice ? <p role="status" className="mb-4 rounded-xl border border-line p-4 text-ink">{notice}</p> : null}
    {error && !create && !edit && !action ? <p role="alert" className="mb-4 text-danger-600">{error}</p> : null}
    {module === "overview" ? <>
      <div className="grid gap-4 sm:grid-cols-3">{[["Buses", buses.data.length], ["Active routes", routes.data.filter((r) => !r.is_completed).length], ["Meeting points", points.data.length]].map(([label, count]) => <Card key={label}><p className="text-3xl font-semibold text-ink">{count}</p><p className="mt-2 text-ink-secondary">{label}</p></Card>)}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{[{ path: "routes", title: "Plan a service", description: "Schedule journeys and assign the fleet." }, { path: "boarding", title: "Start boarding", description: "Scan passes or check your passenger manifest." }, { path: "buses", title: "Manage the fleet", description: "Capacity, availability, assignments and resets." }, { path: "activity", title: "Review activity", description: "See who changed what and when." }].map((item) => <Card key={item.path}><h2 className="type-card-title text-ink">{item.title}</h2><p className="my-3 text-ink-secondary">{item.description}</p><ButtonLink href={`/admin/free-buses/${item.path}`} variant="secondary">{item.title}</ButtonLink></Card>)}</div>
    </> : null}
    {module === "buses" ? <>
      <RecordsTable
        caption="Registered buses"
        rows={buses.data}
        rowKey={(bus) => bus.id}
        searchIn={(bus) => `${bus.license_plate} ${bus.state} ${bus.status} ${routes.data.find((r) => r.id === bus.current_route_id)?.name ?? ""}`}
        searchPlaceholder="Search plate, state or route"
        initialSort={{ id: "plate", direction: "asc" }}
        empty={<Card radius="xl"><EmptyState icon={BusFront} size="sm" title="No buses registered yet" description="Register a vehicle to start assigning it to journeys." /></Card>}
        action={<div className="flex flex-wrap gap-2"><Button onClick={() => open("bus")}>Register bus</Button><Button variant="secondary" onClick={() => open("assign")}>Assign a bus</Button><Button variant="danger" onClick={() => confirm({ danger: true, title: "Reset the entire fleet?", description: "This clears route assignments and passenger counts on EVERY bus and returns them all to Stationary / Available. Only do this after all trips have ended. Existing bookings are not cancelled.", path: "buses/reset-routes", method: "POST", done: "The fleet was reset. Every bus is Stationary and unassigned." })}>Reset fleet</Button></div>}
        columns={[
          { id: "plate", header: "Plate", primary: true, sortBy: (bus) => bus.license_plate, cell: (bus) => <span className="type-numeric font-semibold text-ink">{bus.license_plate}</span> },
          { id: "route", header: "Assigned route", secondary: true, sortBy: (bus) => routes.data.find((r) => r.id === bus.current_route_id)?.name ?? "\uffff", cell: (bus) => <span className="text-ink-secondary">{routes.data.find((r) => r.id === bus.current_route_id)?.name ?? "Unassigned"}</span> },
          { id: "seats", header: "Seats", meta: true, sortBy: (bus) => bus.capacity - bus.current_passenger_count, cell: (bus) => <span className="type-numeric text-ink">{bus.current_passenger_count} / {bus.capacity}</span> },
          { id: "state", header: "State", meta: true, sortBy: (bus) => bus.state, cell: (bus) => <StatusChip tone={bus.state === "Boarding" ? "active" : bus.state === "Transit" ? "info" : "neutral"}>{bus.state}</StatusChip> },
          { id: "status", header: "Availability", meta: true, hideBelow: "xl", sortBy: (bus) => bus.status, cell: (bus) => <StatusChip tone={bus.status === "Maintenance" ? "danger" : bus.status === "InUse" ? "info" : "neutral"}>{bus.status}</StatusChip> },
          { id: "actions", header: "Actions", align: "end", actions: true, cell: (bus) => <div className="flex flex-wrap justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => modify({ kind: "bus", value: bus })}>Manage</Button>
            <ButtonLink size="sm" variant="ghost" href={`/admin/free-buses/boarding?bus=${encodeURIComponent(bus.id)}`}>Boarding</ButtonLink>
            <Button size="sm" variant="ghost" onClick={() => confirm({ danger: true, title: `Reset ${bus.license_plate}?`, description: `This clears the route and passenger count on ${bus.license_plate} and returns it to Stationary / Available. Finish the current trip first. Tickets are not cancelled.`, path: `buses/${bus.id}/reset`, method: "POST", done: `${bus.license_plate} was reset.` })}>Reset</Button>
            <Button size="sm" variant="ghost" className="!text-danger-600" onClick={() => confirm({ danger: true, title: `Delete ${bus.license_plate} permanently?`, description: `This removes the vehicle from the fleet for good and cannot be undone. Any history that references it stays, but the bus will no longer be assignable. The API will refuse if it still has active bookings.`, path: `buses/${bus.id}`, method: "DELETE", done: `${bus.license_plate} was deleted.` })}>Delete</Button>
          </div> },
        ]}
      />
    </> : null}
    {module === "routes" ? <>
      <RecordsTable
        caption="Scheduled journeys"
        rows={routes.data}
        rowKey={(route) => route.id}
        searchIn={(route) => `${route.name} ${pointName(route.start_point)} ${pointName(route.end_point)} ${route.departure_date} ${route.ride_type}`}
        searchPlaceholder="Search name, stop or date"
        initialSort={{ id: "departs", direction: "desc" }}
        empty={<Card radius="xl"><EmptyState icon={RouteIcon} size="sm" title="No journeys scheduled yet" description="Schedule buses to publish the first journey to members." action={<Button onClick={() => open("route")}>Schedule buses</Button>} /></Card>}
        action={<Button onClick={() => open("route")}>Schedule buses</Button>}
        columns={[
          { id: "name", header: "Journey", primary: true, sortBy: (route) => route.name, cell: (route) => <span className="font-medium text-ink">{route.name}</span> },
          { id: "leg", header: "Route", secondary: true, cell: (route) => <span className="text-ink-secondary">{pointName(route.start_point)} → {pointName(route.end_point)}</span> },
          { id: "departs", header: "Departs", meta: true, sortBy: (route) => `${route.departure_date}T${route.departure_time}`, cell: (route) => <span className="type-numeric text-ink">{route.departure_date} · {route.departure_time.slice(0, 5)}</span> },
          { id: "fleet", header: "Buses", meta: true, sortBy: (route) => buses.data.filter((b) => b.current_route_id === route.id).length, cell: (route) => <span className="type-numeric text-ink">{buses.data.filter((b) => b.current_route_id === route.id).length}</span> },
          { id: "state", header: "Status", meta: true, sortBy: (route) => (route.is_completed ? "Completed" : route.ride_type), cell: (route) => <StatusChip tone={route.is_completed ? "neutral" : "active"}>{route.is_completed ? "Completed" : route.ride_type}</StatusChip> },
          { id: "distance", header: "Distance", meta: true, hideBelow: "xl", sortBy: (route) => route.distance, cell: (route) => <span className="type-numeric text-ink-secondary">{route.distance} km</span> },
          { id: "actions", header: "Actions", align: "end", actions: true, cell: (route) => <div className="flex flex-wrap justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => modify({ kind: "route", value: route })}>Edit</Button>
            <Button size="sm" variant="ghost" disabled={route.is_completed} onClick={() => confirm({ title: "Mark this journey complete?", description: `This confirms ${route.name} has reached its destination. Members will no longer be able to book a seat on it, and it moves out of the active list.`, path: `routes/${route.id}/complete`, method: "PATCH", done: `${route.name} is marked complete.` })}>Complete</Button>
            <Button size="sm" variant="ghost" className="!text-danger-600" onClick={() => confirm({ danger: true, title: `Delete ${route.name} permanently?`, description: `This deletes the journey for good and cannot be undone. Members holding a seat on it will lose that journey from their list. The API will refuse if it still has bookings or assigned buses.`, path: `routes/${route.id}`, method: "DELETE", done: `${route.name} was deleted.` })}>Delete</Button>
          </div> },
        ]}
      />
    </> : null}
    {module === "points" ? <>
      <RecordsTable
        caption="Boarding points"
        rows={points.data}
        rowKey={(point) => point.id}
        searchIn={(point) => `${point.name} ${point.landmark} ${point.description}`}
        searchPlaceholder="Search name or landmark"
        initialSort={{ id: "name", direction: "asc" }}
        empty={<Card radius="xl"><EmptyState icon={MapPin} size="sm" title="No boarding points yet" description="Add the places members gather before a journey can be scheduled." action={<Button onClick={() => open("point")}>Add point</Button>} /></Card>}
        action={<Button onClick={() => open("point")}>Add point</Button>}
        columns={[
          { id: "name", header: "Point", primary: true, sortBy: (point) => point.name, cell: (point) => <span className="font-medium text-ink">{point.name}</span> },
          { id: "landmark", header: "Landmark", secondary: true, sortBy: (point) => point.landmark, cell: (point) => <span className="text-ink-secondary">{point.landmark}</span> },
          { id: "directions", header: "Directions", meta: true, hideBelow: "xl", cell: (point) => <span className="text-ink-secondary">{point.description}</span> },
          { id: "coords", header: "Coordinates", meta: true, cell: (point) => <span className="type-numeric text-ink-muted">{point.geo_location.lat}, {point.geo_location.long}</span> },
          { id: "routes", header: "Used by", meta: true, sortBy: (point) => routes.data.filter((r) => r.start_point === point.id || r.end_point === point.id).length, cell: (point) => <span className="type-numeric text-ink">{routes.data.filter((r) => r.start_point === point.id || r.end_point === point.id).length}</span> },
          { id: "actions", header: "Actions", align: "end", actions: true, cell: (point) => { const used = routes.data.filter((r) => r.start_point === point.id || r.end_point === point.id || r.stops.includes(point.id)).length; return <div className="flex flex-wrap justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => modify({ kind: "point", value: point })}>Edit</Button>
            <Button size="sm" variant="ghost" className="!text-danger-600" onClick={() => confirm({ danger: true, title: `Delete ${point.name} permanently?`, description: `${used > 0 ? `${used} scheduled ${used === 1 ? "journey uses" : "journeys use"} this stop. Deleting it will break ${used === 1 ? "that journey" : "those journeys"} for members. ` : ""}This cannot be undone.`, path: `points${queryString({ id: point.id })}`, method: "DELETE", done: `${point.name} was deleted.` })}>Delete</Button>
          </div>; } },
        ]}
      />
    </> : null}
    <Modal open={Boolean(create)} onClose={() => { if (!busy) setCreate(null); }} title={create === "route" ? "Schedule buses" : create === "assign" ? "Assign a bus" : `Add ${create ?? "record"}`} size="lg">
      {create ? <OperationsForm key={create} panel={create} points={points.data} routes={routes.data} buses={buses.data} busy={busy} error={error} onPartialSave={setNotice} onSubmit={async (fn, push) => { if (await run(fn) && push) void broadcastPush(push); }} /> : null}
    </Modal>
    <Modal open={Boolean(edit)} onClose={() => { if (!busy) setEdit(null); }} title={`Manage ${edit?.kind ?? "record"}`} size="lg">
      {edit ? <RecordEditor key={`${edit.kind}-${edit.value.id}`} edit={edit} points={points.data} routes={routes.data} busy={busy} error={error} onSave={(path, method, body) => run(() => freebusRequest(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))} /> : null}
    </Modal>
    <ConfirmDialog open={Boolean(action)} onClose={() => { if (!busy) setAction(null); }} tone={action?.danger ? "danger" : "default"} title={action?.title ?? "Confirm change"} description={`${action?.description ?? ""}${error ? ` Error: ${error}` : ""}`} confirmLabel={action?.danger ? "Yes, do it" : "Confirm"} loading={busy} onConfirm={async () => { if (action) await run(() => freebusRequest(action.path, { method: action.method, ...(action.body === undefined ? {} : { body: JSON.stringify(action.body) }) }), action.done); }} />
  </>;
}

const options = (values: string[]) => values.map((value) => ({ value, label: value }));
function RecordEditor({ edit, points, routes, busy, error, onSave }: { edit: Edit; points: ApiPoint[]; routes: ApiRoute[]; busy: boolean; error: string; onSave: (path: string, method: string, body?: unknown) => Promise<boolean> }) {
  const [operation, setOperation] = useState("details");
  const [validation, setValidation] = useState("");
  const [location, setLocation] = useState(edit.kind === "point" ? { lat: Number(edit.value.geo_location.lat), lng: Number(edit.value.geo_location.long) } : null);
  const [start, setStart] = useState(edit.kind === "route" ? edit.value.start_point : "");
  const [end, setEnd] = useState(edit.kind === "route" ? edit.value.end_point : "");
  const [stops, setStops] = useState(edit.kind === "route" ? edit.value.stops : []);
  const pointOptions = points.map((p) => ({ value: p.id, label: p.name }));
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setValidation("");
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    if (edit.kind === "bus") {
      const base = `buses/${edit.value.id}`;
      const requests: Record<string, { path: string; method: string; body?: unknown }> = {
        details: { path: base, method: "PATCH", body: { license_plate: value("plate") } },
        capacity: { path: `${base}/capacity`, method: "PATCH", body: { capacity: Number(value("capacity")) } },
        allocation: { path: `${base}/allocation`, method: "PATCH", body: { passenger_count: Number(value("passenger_count")) } },
        state: { path: `${base}/state`, method: "PATCH", body: { state: value("state") } },
        status: { path: `${base}/status`, method: "PATCH", body: { status: value("status") } },
        route: { path: `${base}/route`, method: "PATCH", body: { route_id: value("route_id") || null } },
        "clear-allocation": { path: `${base}/clear-allocation`, method: "POST" },
      };
      const request = requests[operation];
      await onSave(request.path, request.method, request.body);
    } else if (edit.kind === "point") {
      if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) { setValidation("Choose valid coordinates."); return; }
      await onSave(`points${queryString({ id: edit.value.id })}`, "PATCH", { id: edit.value.id, name: value("name"), landmark: value("landmark"), description: value("description"), geo_location: { lat: String(location.lat), long: String(location.lng) } });
    } else {
      if (start === end) { setValidation("Boarding point and destination must differ."); return; }
      if (!Number.isFinite(Number(value("distance"))) || Number(value("distance")) <= 0) { setValidation("Wait for the road distance, or enter a verified distance if routing is unavailable."); return; }
      await onSave(`routes/${edit.value.id}`, "PATCH", { name: value("name"), description: value("description"), start_point: start, end_point: end, stops, distance: Number(value("distance")), departure_date: value("date"), departure_time: value("time").length === 5 ? `${value("time")}:00` : value("time"), ride_type: value("direction") });
    }
  }}>
    {edit.kind === "bus" ? <>
      <Select label="Action" value={operation} onChange={(e) => setOperation(e.target.value)} options={[{ value: "details", label: "Edit registration" }, { value: "capacity", label: "Change seat capacity" }, { value: "state", label: "Change movement state" }, { value: "status", label: "Change availability" }, { value: "route", label: "Change / clear route" }, { value: "allocation", label: "Adjust passenger count" }, { value: "clear-allocation", label: "Clear passenger count" }]} />
      {operation === "details" ? <Input label="Registration plate" name="plate" required defaultValue={edit.value.license_plate} /> : null}
      {operation === "capacity" ? <Input label="Passenger seats" name="capacity" type="number" min={Math.max(1, edit.value.current_passenger_count)} max={100} step={1} required defaultValue={edit.value.capacity} /> : null}
      {operation === "allocation" ? <Input label="Passenger count" name="passenger_count" type="number" min={0} max={edit.value.capacity} step={1} required defaultValue={edit.value.current_passenger_count} /> : null}
      {operation === "state" ? <Select label="Movement state" name="state" defaultValue={edit.value.state} options={options(["Stationary", "Boarding", "Transit", "Arrived"])} /> : null}
      {operation === "status" ? <Select label="Availability" name="status" defaultValue={edit.value.status} options={options(["Available", "Maintenance", "InUse"])} /> : null}
      {operation === "route" ? <Select label="Assigned route" name="route_id" defaultValue={edit.value.current_route_id ?? ""} options={[{ value: "", label: "Clear route assignment" }, ...routes.filter((r) => !r.is_completed || r.id === edit.value.current_route_id).map((r) => ({ value: r.id, label: r.name }))]} /> : null}
      {["clear-allocation", "allocation", "route", "state"].includes(operation) ? <label className="flex items-start gap-3 text-sm text-ink-secondary"><input type="checkbox" required className="mt-1" />I confirm this reflects the actual bus operation. Count and route changes do not cancel existing bookings.</label> : null}
    </> : edit.kind === "point" ? <>
      <Input label="Location name" name="name" required defaultValue={edit.value.name} /><Input label="Meeting landmark" name="landmark" required defaultValue={edit.value.landmark} /><Input label="Directions" name="description" required defaultValue={edit.value.description} /><MapPicker value={location} onChange={setLocation} />
    </> : <>
      <Input label="Route name" name="name" required defaultValue={edit.value.name} /><Input label="Boarding instructions" name="description" required defaultValue={edit.value.description} />
      <Select label="Direction" name="direction" defaultValue={edit.value.ride_type} options={options(["Pickup", "Dropoff", "RoundTrip"])} />
      <Select label="Boarding location" value={start} onChange={(e) => { setStart(e.target.value); setStops((v) => v.filter((id) => id !== e.target.value)); }} options={pointOptions} /><Select label="Destination" value={end} onChange={(e) => { setEnd(e.target.value); setStops((v) => v.filter((id) => id !== e.target.value)); }} options={pointOptions} />
      <fieldset className="rounded-xl border border-line p-3"><legend>Intermediate stops (selection order)</legend>{points.filter((p) => p.id !== start && p.id !== end).map((p) => <label key={p.id} className="flex min-h-11 items-center gap-2 text-ink"><input type="checkbox" checked={stops.includes(p.id)} onChange={(e) => setStops((v) => e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id))} />{p.name}{stops.includes(p.id) ? ` · stop ${stops.indexOf(p.id) + 1}` : ""}</label>)}</fieldset>
      <div className="grid grid-cols-2 gap-3"><Input label="Departure date" name="date" type="date" required defaultValue={edit.value.departure_date} /><Input label="Departure time (WAT)" name="time" type="time" required defaultValue={edit.value.departure_time.slice(0, 5)} /></div>
      <RouteDistance points={points} ids={[start, ...stops, end]} />
    </>}
    {error || validation ? <p role="alert" className="text-danger-600">{error || validation}</p> : null}<Button block type="submit" loading={busy}>Save changes</Button>
  </form>;
}
