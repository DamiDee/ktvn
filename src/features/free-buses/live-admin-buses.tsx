"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MapPicker } from "@/components/ui/map-picker";
import { freebusRequest } from "@/services/freebus-api";
import type { ApiBus, ApiPoint, ApiRoute, ApiTrip } from "@/types/freebus-api";
import { watParts } from "@/lib/trips";
import { RouteDistance } from "./route-distance";
import { StopPicker } from "./stop-picker";

export function OperationsForm({ panel, initialTrip = "", points, routes, trips, buses, busy, error, onSubmit }: {
  panel: "route" | "point" | "bus" | "assign"; initialTrip?: string; points: ApiPoint[]; routes: ApiRoute[]; trips: ApiTrip[]; buses: ApiBus[]; busy: boolean; error: string;
  onSubmit: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [validation, setValidation] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [boarding, setBoarding] = useState("");
  const [directions, setDirections] = useState("");
  const pointOptions = [{ value: "", label: "Choose a location" }, ...points.map((p) => ({ value: p.id, label: p.name }))];
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setValidation("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (panel === "point") {
      if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) { setValidation("Choose valid coordinates."); return; }
      await onSubmit(() => freebusRequest("points", { method: "POST", body: JSON.stringify({ name: value("name"), landmark: value("landmark"), description: value("description"), geo_location: { lat: String(location.lat), long: String(location.lng) } }) }));
    } else if (panel === "bus") {
      await onSubmit(() => freebusRequest("buses", { method: "POST", body: JSON.stringify({ license_plate: value("plate"), capacity: Number(value("capacity")), state: "Stationary", status: "Available" }) }));
    } else if (panel === "assign") {
      await onSubmit(() => freebusRequest(`buses/${value("bus")}/assign-trip`, { method: "POST", body: JSON.stringify({ trip_id: value("trip") }) }));
    } else {
      if (start === end) { setValidation("Boarding point and destination must differ."); return; }
      if (!Number.isFinite(Number(value("distance"))) || Number(value("distance")) <= 0) { setValidation("Wait for a calculated distance or enter a verified distance after a routing failure."); return; }
      await onSubmit(() => freebusRequest<ApiRoute>("routes", { method: "POST", body: JSON.stringify({ name: value("name"), description: value("description"), start_point: start, end_point: end, fare: 0, distance: Number(value("distance")), stops }) }));
    }
  }}>
    {panel === "point" ? <>
      <Input label="Location name" name="name" required value={name} onChange={(e) => setName(e.target.value)} /><Input label="Meeting landmark" name="landmark" required placeholder="Under the pedestrian bridge, opposite the filling station" hint="What a member should look for when they arrive." />
      <Input label="Directions" name="description" required value={directions} onChange={(e) => setDirections(e.target.value)} placeholder="Stand on the church side of the road. The bus pulls in at the lay-by." hint="How to find the exact spot, and which side to wait on." />
      <MapPicker value={location} onChange={setLocation} onPlaceSelect={(place) => { if (!name) setName(place.name); if (!directions) setDirections(`Wait beside ${place.name}. Look out for the K-Rides bus and be at the point 15 minutes before departure.`); }} />
    </> : panel === "bus" ? <><Input label="Registration plate" name="plate" required /><Input label="Passenger seats" name="capacity" type="number" min={1} max={100} step={1} defaultValue={18} required /></> : panel === "assign" ? <>
      <Select label="Unassigned bus" name="bus" required options={[{ value: "", label: "Choose a bus" }, ...buses.filter((b) => !b.current_trip_id && b.current_passenger_count === 0 && b.status !== "Maintenance" && b.state !== "Transit").map((b) => ({ value: b.id, label: b.license_plate }))]} />
      <Select label="Scheduled trip" name="trip" required defaultValue={initialTrip} options={[{ value: "", label: "Choose a trip" }, ...trips.filter((t) => t.status === "NotStarted").map((t) => ({ value: t.id, label: `${routes.find((r) => r.id === t.route_id)?.name ?? t.route_id} · ${watParts(t.departure_time).date} ${watParts(t.departure_time).time}` }))]} />
    </> : <>
      <p className="text-sm text-ink-secondary">Create this route once. Schedule as many departures on it as you like from the Trips module, on any day, without recreating the route.</p>
      <Input label="Route name" name="name" placeholder="Lugbe to Koinonia Sunday Service" required />
      <Select label="Boarding location" value={start} onChange={(e) => { setStart(e.target.value); setStops((v) => v.filter((id) => id !== e.target.value)); const point = points.find((p) => p.id === e.target.value); if (point && !boarding) setBoarding(`Board at ${point.name}. ${point.landmark}. Please arrive 15 minutes before departure — the bus leaves on time.`); }} required options={pointOptions} />
      <Select label="Destination" value={end} onChange={(e) => { setEnd(e.target.value); setStops((v) => v.filter((id) => id !== e.target.value)); }} required options={pointOptions} />
      <Input label="Boarding instructions" name="description" required value={boarding} onChange={(e) => setBoarding(e.target.value)} placeholder="Board at the signpost. Arrive 15 minutes early." hint="Members read this before they travel. Choosing a boarding point fills in a starting point you can edit." />
      <StopPicker points={points} start={start} end={end} stops={stops} onChange={setStops} />
      <RouteDistance points={points} ids={[start, ...stops, end]} />
    </>}
    {validation || error ? <p role="alert" className="text-danger-600">{validation || error}</p> : null}
    <Button block type="submit" loading={busy}>{panel === "route" ? "Create reusable route" : "Save"}</Button>
  </form>;
}
