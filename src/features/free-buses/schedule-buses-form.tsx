"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ABUJA_BUS_POINTS, DIRECTION_NAMES, SERVICE_NAMES } from "@/lib/free-buses";
import { freeBusService } from "@/services/free-bus-service";
import type { BusActor, BusDirection, BusServiceEvent, ChurchService } from "@/types/free-buses";
import { busDate } from "./bus-components";

export function ScheduleBusesForm({ events, actor, onSaved, onBusyChange }: {
  events: BusServiceEvent[]; actor: BusActor; onSaved: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "NEW");
  const [service, setService] = useState<ChurchService>("KOINONIA");
  const [date, setDate] = useState(events[0]?.date ?? "");
  const [venue, setVenue] = useState("");
  const [venueMeetingPoint, setVenueMeetingPoint] = useState("");
  const [direction, setDirection] = useState<BusDirection>("TO_SERVICE");
  const [communityPoint, setCommunityPoint] = useState("");
  const [landmark, setLandmark] = useState("");
  const [boardingAt, setBoardingAt] = useState("");
  const [count, setCount] = useState("3");
  const [capacity, setCapacity] = useState("18");
  const [model, setModel] = useState("Toyota Hiace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = events.find((event) => event.id === eventId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true); onBusyChange(true);
    try {
      await freeBusService.schedule({
        eventId: existing?.id, service: existing?.service ?? service,
        date: existing?.date ?? date, venue: existing?.venue ?? venue,
        venueMeetingPoint: existing?.venueMeetingPoint ?? venueMeetingPoint,
        direction, communityPoint, landmark,
        boardingAt: new Date(`${boardingAt}:00+01:00`).toISOString(),
        busCount: Number(count), capacity: Number(capacity), model,
      }, actor);
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't publish this schedule."); }
    finally { setBusy(false); onBusyChange(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Select label="Service schedule" value={eventId} onChange={(e) => setEventId(e.target.value)} options={[...events.map((event) => ({ value: event.id, label: `${SERVICE_NAMES[event.service]} · ${busDate(event.date)}` })), { value: "NEW", label: "+ New service date" }]} />
      {!existing ? <div className="space-y-4 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Church service" value={service} onChange={(e) => setService(e.target.value as ChurchService)} options={Object.entries(SERVICE_NAMES).map(([value, label]) => ({ value, label }))} required />
          <Input label="Service date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <Input label="Service venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue name and area in Abuja" required maxLength={160} />
        <Input label="Return boarding point at the venue" value={venueMeetingPoint} onChange={(e) => setVenueMeetingPoint(e.target.value)} placeholder="e.g. Main car park, Bay B" required maxLength={240} />
      </div> : <p className="type-meta text-ink-muted">Venue: {existing.venue} · Return boarding: {existing.venueMeetingPoint}</p>}

      <Select label="Journey direction" value={direction} onChange={(e) => setDirection(e.target.value as BusDirection)} options={Object.entries(DIRECTION_NAMES).map(([value, label]) => ({ value, label }))} />
      <Input label={direction === "TO_SERVICE" ? "Community pickup point" : "Community drop-off point"} list="abuja-free-bus-points" value={communityPoint} onChange={(e) => setCommunityPoint(e.target.value)} placeholder={direction === "TO_SERVICE" ? "Lugbe Police Signpost" : "Lugbe Federal Housing Junction"} required maxLength={120} />
      <datalist id="abuja-free-bus-points">{ABUJA_BUS_POINTS.map((point) => <option key={point} value={point} />)}</datalist>
      <Input label={direction === "TO_SERVICE" ? "Pickup meeting instructions" : "Drop-off landmark"} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Help members find the exact spot" required maxLength={240} />
      <Input label="Boarding date and time (Abuja / WAT)" type="datetime-local" value={boardingAt} onChange={(e) => setBoardingAt(e.target.value)} required hint="Schedule each direction separately, including returns after midnight." />
      <Input label="Bus model" value={model} onChange={(e) => setModel(e.target.value)} required maxLength={80} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Number of buses" type="number" min={0} max={30} step={1} value={count} onChange={(e) => setCount(e.target.value)} required />
        <Input label="Passenger seats per bus" type="number" min={1} max={60} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
      </div>
      <p className="type-meta text-ink-muted">{Number(count) * Number(capacity) || 0} free seats. Members see this allocation immediately after publication.</p>
      {error ? <p role="alert" className="type-meta text-danger-600 dark:text-red-300">{error}</p> : null}
      <Button type="submit" block loading={busy} loadingLabel="Publishing">Publish bus schedule</Button>
    </form>
  );
}
