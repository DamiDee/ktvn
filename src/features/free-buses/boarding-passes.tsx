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
    <Card className="mx-auto max-w-2xl overflow-hidden !p-0">
      <div className="bg-forest-900 p-6 text-white"><p className="text-sm text-gold-300">K-Rides · Free Buses</p><h1 className="mt-2 text-3xl font-semibold">Boarding pass</h1><p className="mt-3">{route.data?.name ?? "Loading journey…"}</p></div>
      <div className="flex flex-col p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm text-ink-muted">Passenger</p><h2 className="text-xl font-semibold text-ink">{user.first_name} {user.last_name}</h2></div><div><p className="text-sm text-ink-muted">Seat</p><p className="text-4xl font-bold text-ink">{ticket.seat_number}</p></div></div>
        <dl className="order-2 mt-6 grid grid-cols-2 gap-4">{[
          ["Bus registration", bus.data?.license_plate ?? ticket.bus_id], ["Booking status", ticket.status],
          ["Boarding point", start.data?.name ?? route.data?.start_point ?? "Loading…"], ["Destination", end.data?.name ?? route.data?.end_point ?? "Loading…"],
          ["Departure (WAT)", trip.data ? `${watParts(trip.data.departure_time).date} · ${watParts(trip.data.departure_time).time}` : "Schedule unavailable"], ["Journey", trip.data?.ride_type ?? "Loading…"], ["Trip status", trip.data?.status ?? "Unavailable"],
          ["Meeting landmark", start.data?.landmark ?? "Not available"], ["Payment", ticket.payment_status],
          ["Boarding instructions", route.data?.description ?? "Not available"], ["Distance", route.data ? `${route.data.distance} km` : "Not available"],
          ["Booking reference", ticket.booking_ref], ["Booked at (API time)", ticket.created_at.replace("T", " ")],
        ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd></div>)}</dl>
        {trip.error || route.error || bus.error || start.error || end.error ? <p role="alert" className="mt-4 text-danger-600">Some journey details are unavailable. <button className="underline" onClick={() => void client.invalidateQueries({ queryKey: ["freebus-live"] })}>Retry</button></p> : null}
        <div className="order-1 mt-4 border-b border-dashed border-line pb-4 text-center">
          {booking.data?.trip_id && trip.isPending ? <p role="status" className="text-ink-secondary">Checking departure…</p> : active ? qr.error ? <ErrorState title="QR pass unavailable" description={qr.error.message} onRetry={() => void qr.refetch()} /> : image ? <>
            {/* The API supplies the signed PNG; never generate unsigned lookalike tickets. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Signed QR boarding pass" width={256} height={256} className="mx-auto aspect-square h-auto w-64 max-w-full rounded-xl bg-white p-4" />
            <p className="mt-3 text-sm text-ink-secondary">Show this code to the boarding team. Keep your pass private.</p>
          </> : <p role="status" className="text-ink-secondary">{qr.data ? "The API returned an unreadable QR image. Please refresh your pass." : "Loading secure QR pass…"}</p> : <p className="font-semibold text-ink">{ticket.status === "Boarded" ? "Already boarded — have a safe journey." : trip.data ? `${trip.data.status.replace(/([a-z])([A-Z])/g, "$1 $2")} — this pass cannot be used for boarding.` : "Trip details unavailable — ask the boarding team for help."}</p>}
        </div>
        {active ? <Button variant="ghost" className="order-3 mt-5 print:hidden" onClick={() => setCancel(true)}>Release seat</Button> : null}
      </div>
    </Card>
    <ConfirmDialog open={cancel} onClose={() => { if (!busy) setCancel(false); }} tone="danger" title="Release this seat?" description={error || "Your boarding pass stops working straight away and another member can take the seat. This cannot be undone."} confirmLabel="Yes, release it" loading={busy} onConfirm={async () => { setBusy(true); setError(""); try { await freebusRequest(`bookings/${id}`, { method: "DELETE" }); setCancel(false); await client.invalidateQueries({ queryKey: ["freebus-live"] }); } catch (e) { setError(e instanceof Error ? e.message : "Cancellation failed."); } finally { setBusy(false); } }} />
  </>;
}
