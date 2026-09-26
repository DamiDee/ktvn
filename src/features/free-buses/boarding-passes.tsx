"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/modal";
import { useLiveQuery } from "./live-queries";
import { useLiveUser } from "./live-shell";
import { freebusRequest } from "@/services/freebus-api";
import { qrImageSource, type BookingQr } from "@/lib/boarding";
import { watParts } from "@/lib/trips";
import { BusFront, CheckCircle2, MapPin, Ticket } from "lucide-react";
import { BoardedCelebration } from "./boarded-celebration";
import type { ApiBooking, ApiBus, ApiPoint, ApiRoute, ApiTrip } from "@/types/freebus-api";

export function BoardingPasses() {
  const bookings = useLiveQuery<ApiBooking[]>("bookings/me");
  return <><PageHeader eyebrow="Free Buses" title="Boarding passes" description="Your seat, bus and travel details, ready at the door." />{bookings.error ? <ErrorState title="Could not load passes" description={bookings.error.message} onRetry={() => void bookings.refetch()} /> : bookings.isPending ? <p>Loading passes…</p> : <div className="grid gap-4 sm:grid-cols-2">{bookings.data.map((booking) => <Card key={booking.id}><p className="text-sm text-ink-secondary">{booking.status}</p><h2 className="mt-2 text-2xl font-semibold text-ink">Seat {booking.seat_number}</h2><p className="my-3 break-all text-ink-secondary">{booking.booking_ref}</p><ButtonLink href={`/passenger/free-buses/passes/${booking.id}`}>View boarding pass</ButtonLink></Card>)}{!bookings.data.length ? <Card><p className="mb-4 text-ink-secondary">You haven’t booked a seat yet.</p><ButtonLink href="/passenger/free-buses">Find a bus</ButtonLink></Card> : null}</div>}</>;
}

export function BoardingPass({ id }: { id: string }) {
  const user = useLiveUser();
  const booking = useLiveQuery<ApiBooking>(`bookings/${encodeURIComponent(id)}`);
  const route = useLiveQuery<ApiRoute>(`routes/${booking.data?.route_id}`, Boolean(booking.data));
  const trip = useLiveQuery<ApiTrip>(`trips/${booking.data?.trip_id}`, Boolean(booking.data?.trip_id));
  const bus = useLiveQuery<ApiBus>(`buses/${booking.data?.bus_id}`, Boolean(booking.data));
  const start = useLiveQuery<ApiPoint>(`points/${route.data?.start_point}`, Boolean(route.data));
  const end = useLiveQuery<ApiPoint>(`points/${route.data?.end_point}`, Boolean(route.data));
  const active = booking.data?.status === "Confirmed" && trip.data?.status === "NotStarted";
  const qr = useLiveQuery<BookingQr>(`bookings/${encodeURIComponent(id)}/qrcode`, active);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  if (booking.error) return <ErrorState title="Could not load boarding pass" description={booking.error.message} onRetry={() => void booking.refetch()} />;
  if (!booking.data) return <p role="status">Loading boarding pass…</p>;
  const ticket = booking.data;
  const image = qr.data?.booking_id === ticket.id ? qrImageSource(qr.data.qr_code_base64) : null;
  return <>
    <div className="mb-4 flex flex-wrap gap-2 print:hidden"><ButtonLink variant="ghost" href="/passenger/free-buses/passes">All boarding passes</ButtonLink><Button variant="secondary" onClick={() => window.print()}>Print / save PDF</Button></div>
    <Card className="mx-auto max-w-2xl overflow-hidden !rounded-[28px] !p-0 shadow-lg">
      <div className="relative overflow-hidden bg-forest-900 p-6 text-white sm:p-8"><div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border-[32px] border-gold-300/5" aria-hidden /><div className="relative"><div className="flex items-center justify-between gap-4"><p className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-gold-300 uppercase"><BusFront className="size-4" aria-hidden />K-Rides · Free Buses</p><Ticket className="size-5 text-gold-200/60" aria-hidden /></div><h1 className="mt-5 text-3xl font-semibold tracking-tight">Your boarding pass.</h1><p className="mt-2 break-words text-sm text-white/70">{route.data?.name ?? "Loading journey…"}</p><span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gold-100">{ticket.status === "Boarded" ? <CheckCircle2 className="size-3.5" aria-hidden /> : <Ticket className="size-3.5" aria-hidden />}{ticket.status === "Boarded" ? "Boarding confirmed" : ticket.status}</span></div></div>
      <div className="flex flex-col p-5 sm:p-8"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-[.65rem] font-medium tracking-[.12em] text-ink-muted uppercase">Travelling with us</p><h2 className="mt-1.5 break-words text-xl font-semibold tracking-tight text-ink">{user.first_name} {user.last_name}</h2><p className="mt-2 flex items-center gap-1.5 text-xs text-ink-secondary"><BusFront className="size-3.5 shrink-0" aria-hidden />{bus.data?.license_plate ?? "Bus details loading…"}</p></div><div className="shrink-0 rounded-2xl border border-gold-500/25 bg-gold-500/10 px-5 py-3 text-center"><p className="text-[.6rem] font-semibold tracking-[.12em] text-gold-800 uppercase dark:text-gold-300">Seat</p><p className="mt-1 text-4xl font-semibold tracking-tight text-ink tabular-nums">{ticket.seat_number}</p></div></div>
        <dl className="order-2 mt-6 grid grid-cols-2 gap-4">{[
          ["Bus registration", bus.data?.license_plate ?? ticket.bus_id], ["Booking status", ticket.status],
          ["Boarding point", start.data?.name ?? route.data?.start_point ?? "Loading…"], ["Destination", end.data?.name ?? route.data?.end_point ?? "Loading…"],
          ["Departure (WAT)", trip.data ? `${watParts(trip.data.departure_time).date} · ${watParts(trip.data.departure_time).time}` : "Schedule unavailable"], ["Journey", trip.data?.ride_type ?? "Loading…"], ["Trip status", trip.data?.status ?? "Unavailable"],
          ["Meeting landmark", start.data?.landmark ?? "Not available"], ["Payment", ticket.payment_status],
          ["Boarding instructions", route.data?.description ?? "Not available"], ["Distance", route.data ? `${route.data.distance} km` : "Not available"],
          ["Booking reference", ticket.booking_ref], ["Booked at (API time)", ticket.created_at.replace("T", " ")],
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd></div>)}</dl>
        {trip.error || route.error || bus.error || start.error || end.error ? <p role="alert" className="mt-4 text-danger-600">Some journey details are unavailable. <button className="underline" onClick={() => void client.invalidateQueries({ queryKey: ["freebus-live"] })}>Retry</button></p> : null}
        <div className="order-1 mt-6 border-b border-dashed border-line pb-6 text-center">
          {ticket.status === "Boarded" && trip.data?.status !== "Cancelled" ? <BoardedCelebration completed={trip.data?.status === "Completed"} /> : booking.data?.trip_id && trip.isPending ? <p role="status" className="text-ink-secondary">Checking departure…</p> : active ? qr.error ? <ErrorState title="QR pass unavailable" description={qr.error.message} onRetry={() => void qr.refetch()} /> : image ? <>
            {/* The API supplies the signed PNG; never generate unsigned lookalike tickets. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Signed QR boarding pass" width={256} height={256} className="mx-auto aspect-square h-auto w-64 max-w-full rounded-xl bg-white p-4" />
            <p className="mt-3 text-sm font-medium text-ink">One scan, and you’re on your way.</p><p className="mt-1 text-xs text-ink-muted">Show this code to the boarding team. Keep your pass private.</p>
          </> : <p role="status" className="text-ink-secondary">{qr.data ? "The API returned an unreadable QR image. Please refresh your pass." : "Loading secure QR pass…"}</p> : <p className="font-semibold text-ink">{ticket.status === "Cancelled" || ticket.status === "Revoked" ? `${ticket.status} — this pass cannot be used for boarding.` : trip.data ? `${trip.data.status.replace(/([a-z])([A-Z])/g, "$1 $2")} — this pass cannot be used for boarding.` : "Trip details unavailable — ask the boarding team for help."}</p>}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-muted"><MapPin className="size-3.5 shrink-0" aria-hidden />{end.data?.name ?? "Your community journey"}</p>
        </div>
        {active ? <Button variant="ghost" className="order-3 mt-5 print:hidden" onClick={() => setCancel(true)}>Release seat</Button> : null}
      </div>
    </Card>
    <ConfirmDialog open={cancel} onClose={() => { if (!busy) setCancel(false); }} tone="danger" title="Release this seat?" description={error || "Your boarding pass stops working straight away and another member can take the seat. This cannot be undone."} confirmLabel="Yes, release it" loading={busy} onConfirm={async () => { setBusy(true); setError(""); try { await freebusRequest(`bookings/${id}`, { method: "DELETE" }); setCancel(false); await client.invalidateQueries({ queryKey: ["freebus-live"] }); } catch (e) { setError(e instanceof Error ? e.message : "Cancellation failed."); } finally { setBusy(false); } }} />
  </>;
}
