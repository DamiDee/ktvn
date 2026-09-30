"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { walkInAllocation } from "@/lib/journey-experience";
import type { ApiBus, ApiTrip } from "@/types/freebus-api";

export function WalkInBoarding({ bus, disabled }: { bus: ApiBus; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });
  async function add() {
    if (lock.current || uncertain) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    let writing = false;
    try {
      const fresh = await freebusRequest<ApiBus>(`buses/${bus.id}`);
      if (fresh.current_trip_id !== bus.current_trip_id || fresh.current_passenger_count !== bus.current_passenger_count) throw new Error("Bus occupancy or trip changed. Review the refreshed count before adding passengers.");
      if (!fresh.current_trip_id) throw new Error("Assign this bus to a trip before adding passengers.");
      const trip = await freebusRequest<ApiTrip>(`trips/${fresh.current_trip_id}`);
      const payload = walkInAllocation(fresh, trip, count);
      writing = true;
      const saved = await freebusRequest<ApiBus>(`buses/${bus.id}/allocation`, { method: "PATCH", body: JSON.stringify(payload) });
      if (saved.id !== bus.id || saved.current_passenger_count !== payload.passenger_count) throw new Error("The server count did not match. Check occupancy before adding anyone else.");
      setNotice(`${count} walk-in ${count === 1 ? "passenger" : "passengers"} recorded. ${saved.current_passenger_count} of ${saved.capacity} places occupied.`);
      setOpen(false); setCount(1);
    } catch (e) {
      if (writing && (!(e instanceof FreebusError) || e.status === 0 || e.status >= 500)) setUncertain(true);
      setError(e instanceof FreebusError && e.status === 403 ? "Your API account cannot update occupancy. The backend must enable this action for Route Coordinators; no seat was confirmed here." : e instanceof Error ? e.message : "Could not record passengers.");
    } finally { await refresh(); lock.current = false; setBusy(false); }
  }
  return <>
    <Button size="sm" variant="secondary" disabled={disabled || busy} onClick={() => { setError(""); setOpen(true); }}>Add walk-in passengers</Button>
    {notice ? <p role="status" className="mt-3 text-sm text-ink">{notice}</p> : null}
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Board members without a phone" description={`${bus.license_plate} · ${bus.current_passenger_count}/${bus.capacity} occupied`}>
      <p className="text-sm leading-relaxed text-ink-secondary">Only for people without an existing booking. Board already-booked members from the manifest so they aren’t counted twice.</p>
      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Input label="Additional passengers boarding now" type="number" min={1} step={1} max={Math.max(1, bus.capacity - bus.current_passenger_count)} value={count} onChange={(e) => setCount(Number(e.target.value))} required disabled={busy || uncertain} />
        <p className="text-sm text-ink-secondary">Updates occupied places only. No named booking, numbered seat or boarding pass is created.</p>
        <p className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-xs leading-relaxed text-ink-secondary">Use only while no other operator or online booking is changing this bus’s count. This API replaces the total; a simultaneous booking can be overwritten. Atomic increments still need backend support.</p>
        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
        {uncertain ? <div className="space-y-3"><p className="text-sm text-danger-600">The update may have succeeded. Recheck the count and physically confirm it before retrying.</p><Button variant="secondary" type="button" onClick={async () => { setBusy(true); try { await freebusRequest(`buses/${bus.id}`); await refresh(); setUncertain(false); setError("Count refreshed. Confirm it with the boarding team before submitting again."); } catch { setError("Could not recheck occupancy. Do not retry yet."); } finally { setBusy(false); } }} loading={busy}>Recheck occupancy</Button></div> : null}
        <Button type="submit" loading={busy} disabled={uncertain || disabled || count < 1 || bus.current_passenger_count + count > bus.capacity}>Record {count || 0} walk-in {count === 1 ? "passenger" : "passengers"}</Button>
      </form>
    </Modal>
  </>;
}
