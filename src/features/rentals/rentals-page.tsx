"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/app-shell";
import { useRideViewer } from "@/features/paid-rides/hooks/use-ride-viewer";
import { RidePage } from "@/features/paid-rides/components/ride-page";
import { localScheduleTime, resolveScheduleTime } from "@/features/paid-rides/scheduling/contract";
import { scheduleError } from "@/features/paid-rides/scheduling/booking-card";
import BookingContact from "@/features/paid-rides/scheduling/booking-contact";
import { rentalService } from "./service";
import { RentalError, validateRental, type Rental } from "./contract";
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
function RentalForm({ record, busy, onSave, onClose }: { record?: Rental; busy: boolean; onSave: (input: ReturnType<typeof validateRental>) => Promise<void>; onClose: () => void }) {
  const [timezone] = useState(zone);
  const [start, setStart] = useState(record ? localScheduleTime(record.startsAt, timezone) : "");
  const [end, setEnd] = useState(record ? localScheduleTime(record.endsAt, timezone) : "");
  const [pickup, setPickup] = useState(record?.pickupLocation ?? ""), [notes, setNotes] = useState(record?.notes ?? ""), [error, setError] = useState("");
  return <Card><form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (busy) return; setError(""); try { await onSave(validateRental({ startsAt: resolveScheduleTime(start, timezone), endsAt: resolveScheduleTime(end, timezone), pickupLocation: pickup, notes })); } catch (e) { setError(scheduleError(e)); } }}>
    <h2 className="text-lg font-semibold">{record ? "Edit rental request" : "Request a car rental"}</h2>
    <p className="text-sm text-ink-secondary">Choose at least 24 consecutive hours. Our team will contact you to arrange the car and agree the price. Submitting this request does not reserve or pay for a vehicle.</p>
    <div className="grid gap-4 sm:grid-cols-2"><Input label={`Start · ${timezone}`} type="datetime-local" required value={start} disabled={busy} onChange={e => setStart(e.target.value)} /><Input label={`End · ${timezone}`} type="datetime-local" required value={end} disabled={busy} onChange={e => setEnd(e.target.value)} /></div>
    <Input label="Pickup location" required maxLength={1000} value={pickup} disabled={busy} onChange={e => setPickup(e.target.value)} />
    <Textarea label="Requirements (optional)" hint="For example, passenger count and luggage space." maxLength={5000} value={notes} disabled={busy} onChange={e => setNotes(e.target.value)} />
    {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    <div className="flex gap-3"><Button type="submit" loading={busy}>{record ? "Save changes" : "Send request"}</Button><Button variant="ghost" disabled={busy} onClick={onClose}>Close</Button></div>
  </form></Card>;
}
export function RentalsPage({ admin = false }: { admin?: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const viewer = useRideViewer(), viewerId = viewer.data?.account?.id;
  const [status, setStatus] = useState(admin ? "pending" : ""), [offset, setOffset] = useState(0), [form, setForm] = useState<Rental | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ record: Rental; action: "delete" | "assign" } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const list = useQuery({ queryKey: ["paid-rides", "rentals", viewerId, admin, status, offset], queryFn: ({ signal }) => rentalService.list(admin, status, offset, signal), enabled: !!viewerId, retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true });
  async function mutate(work: () => Promise<unknown>) {
    if (lock.current || uncertain) return; lock.current = true; setBusy(true); setMessage("");
    try { await work(); setOffset(0); setForm(null); setConfirm(null); setMessage("Request updated."); }
    catch (e) { if (e instanceof RentalError && e.uncertain) { setUncertain(true); setForm(null); setConfirm(null); } if (e instanceof RentalError && [404, 409].includes(e.status)) { setForm(null); setConfirm(null); } setMessage(scheduleError(e)); throw e; }
    finally { await list.refetch(); lock.current = false; setBusy(false); }
  }
  async function refresh() {
    // Restart pagination after uncertain writes; do not retry the mutation automatically.
    setOffset(0);
    const result = await rentalService.list(admin, status, 0);
    if (result) { setUncertain(false); setMessage("Requests refreshed. Review the list before submitting again."); void list.refetch(); }
  }
  const time = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const content = <div className="space-y-5">
    <p className="text-sm text-ink-secondary">{admin ? "Arrange the car and price with the customer before marking a request assigned." : "Rent a car for 24 hours or longer. Our team arranges availability and pricing with you."}</p>
    <div className="flex flex-wrap items-end gap-3"><Select label="Status" value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setOffset(0); }} options={[{ value: "", label: "All requests" }, { value: "pending", label: "Pending assignment" }, { value: "assigned", label: "Assigned" }]} /><Button variant="secondary" disabled={busy} onClick={() => void refresh().catch(e => setMessage(scheduleError(e)))}>Refresh requests</Button>{!admin && !form ? <Button disabled={busy || uncertain || !viewerId} onClick={() => setForm("new")}>Request a rental</Button> : null}</div>
    {message ? <p role="status" className="rounded-xl bg-surface-nested p-4 text-sm">{message}</p> : null}
    {uncertain ? <p role="alert" className="text-sm">The last change may have succeeded. Refresh requests and check for it before making another change.</p> : null}
    {form && !admin ? <RentalForm key={form === "new" ? "new" : form.id} record={form === "new" ? undefined : form} busy={busy || uncertain} onClose={() => setForm(null)} onSave={input => mutate(() => form === "new" ? rentalService.create(input) : rentalService.update(form.id, input))} /> : null}
    {viewer.isPending || list.isLoading ? <p role="status">Loading rental requests…</p> : null}
    {viewer.isError || list.isError ? <p role="alert">Requests could not load. Check your connection and sign-in, then refresh.</p> : null}
    <div className="space-y-4">{list.data?.map(record => <Card key={record.id} className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{record.pickupLocation}</h2><span className="text-sm">{record.status === "pending" ? "Pending assignment" : "Assigned"}</span></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-ink-secondary">Start</dt><dd>{time(record.startsAt)}</dd></div><div><dt className="text-ink-secondary">End</dt><dd>{time(record.endsAt)}</dd></div></dl>
      {record.notes ? <p className="whitespace-pre-wrap break-words text-sm">{record.notes}</p> : null}
      {admin && viewerId ? <BookingContact userId={record.userId} viewerId={viewerId} label="Customer" /> : null}
      {record.status === "assigned" ? <p className="text-sm text-ink-secondary">Assigned{record.assignedAt ? ` on ${time(record.assignedAt)}` : ""}. Contact the transport team for the agreed car and pickup arrangements.</p> : <div className="flex flex-wrap gap-2">{admin ? <Button disabled={busy || uncertain || Date.parse(record.startsAt) <= now} onClick={() => setConfirm({ record, action: "assign" })}>Mark assigned</Button> : <><Button variant="secondary" disabled={busy || uncertain} onClick={() => setForm(record)}>Edit request</Button><Button variant="ghost" disabled={busy || uncertain} onClick={() => setConfirm({ record, action: "delete" })}>Delete request</Button></>}{Date.parse(record.startsAt) <= now ? <p className="text-sm text-ink-secondary">The requested start time has passed.</p> : null}</div>}
    </Card>)}</div>
    {list.data?.length === 0 ? <p>No rental requests on this page.</p> : null}
    <div className="flex items-center gap-3"><Button variant="ghost" disabled={offset === 0 || busy || list.isFetching} onClick={() => setOffset(n => Math.max(0, n - 20))}>Previous</Button><span className="text-sm">Page {offset / 20 + 1}</span><Button variant="ghost" disabled={list.data?.length !== 20 || busy || list.isFetching} onClick={() => setOffset(n => n + 20)}>Next</Button></div>
    <ConfirmDialog open={!!confirm} onClose={() => { if (!busy) setConfirm(null); }} title={confirm?.action === "assign" ? "Mark this rental assigned?" : "Delete this request?"} description={confirm?.action === "assign" ? "Confirm that you have arranged the car and price with the customer offline. They will no longer be able to edit or delete this request." : "This permanently removes the pending rental request."} confirmLabel={confirm?.action === "assign" ? "Mark assigned" : "Delete request"} loading={busy} onConfirm={() => { if (confirm) void mutate(() => confirm.action === "assign" ? rentalService.assign(confirm.record.id) : rentalService.remove(confirm.record.id)).catch(() => {}); }} />
    {!admin ? <ButtonLink href="/rides/schedule" variant="ghost">Back to scheduled trips</ButtonLink> : null}
  </div>;
  return admin ? <div className="mx-auto max-w-5xl"><PageHeader eyebrow="Paid rides" title="Rental requests" />{content}</div> : <RidePage title="Car rental" subtitle="A car for a day or longer." backHref="/rides/schedule">{content}</RidePage>;
}
