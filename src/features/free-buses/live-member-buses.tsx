"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BusFront, Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { freebusRequest, FreebusError } from "@/services/freebus-api";
import { activeBooking, availableCapacity, busCanBoard, queryString, routeCanBook } from "@/lib/freebus-contract";
import type { ApiBooking, ApiBus, ApiPoint, ApiRoute } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

export function LiveMemberBuses() {
  const [direction, setDirection] = useState("Pickup");
  const [date, setDate] = useState("");
  const [point, setPoint] = useState("");
  const [service, setService] = useState("");
  const [pending, setPending] = useState<ApiRoute | null>(null);
  const [cancel, setCancel] = useState<ApiBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const client = useQueryClient();
  const { toast } = useToast();
  const routePath = `routes${queryString({ ride_type: direction, departure_date: date, [direction === "Dropoff" ? "end_point" : "start_point"]: point, search: service })}`;
  const routes = useLiveQuery<ApiRoute[]>(routePath);
  const buses = useLiveQuery<ApiBus[]>("buses");
  const points = useLiveQuery<ApiPoint[]>("points");
  const bookings = useLiveQuery<ApiBooking[]>("bookings/me");
  // Ticket labels must remain available even when the member changes the route filters.
  const allRoutes = useLiveQuery<ApiRoute[]>("routes");
  const error = routes.error ?? buses.error ?? points.error ?? bookings.error ?? allRoutes.error;
  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });
  if (error) return <><ErrorState title="We couldn't load Free Buses" description={error.message} onRetry={() => void refresh()} />{error instanceof FreebusError && error.status === 401 ? <ButtonLink href="/login">Sign in again</ButtonLink> : null}</>;
  if (!routes.data || !buses.data || !points.data || !bookings.data || !allRoutes.data) return <PageLoader message="Checking live bus availability" />;
  const location = (id: string) => points.data.find((p) => p.id === id)?.name ?? "Location unavailable";
  const assigned = (route: ApiRoute) => buses.data.filter((b) => b.current_route_id === route.id);
  const tickets = bookings.data.filter(activeBooking);
  const shown = routes.data.filter((r) => r.fare === 0 && !r.is_completed);

  async function reserve() {
    if (!pending) return;
    setBusy(true); setActionError("");
    try {
      // These checks spare the member a round trip; the API is what actually enforces them.
      if (!routeCanBook(pending)) throw new Error("This route is no longer open for booking.");
      const mine = await freebusRequest<ApiBooking[]>("bookings/me");
      if (mine.filter(activeBooking).some((b) => b.route_id === pending.id)) throw new Error("You already have a seat on this route.");
      // Refresh just before submission. Never retry a booking automatically after a timeout.
      const current = await freebusRequest<ApiBus[]>(`buses${queryString({ current_route_id: pending.id })}`);
      const next = current.filter((b) => b.current_route_id === pending.id && availableCapacity(b) > 0).sort((a, b) => a.license_plate.localeCompare(b.license_plate))[0];
      if (!next) throw new Error("No seats remain on this route. Please choose another pickup point.");
      const booking = await freebusRequest<ApiBooking>("bookings", { method: "POST", body: JSON.stringify({ bus_id: next.id, route_id: pending.id }) });
      setPending(null); await refresh();
      toast({ title: `Seat ${booking.seat_number} reserved`, description: `Booking ${booking.booking_ref}`, tone: "success" });
    } catch (error) {
      setActionError(`${error instanceof Error ? error.message : "We couldn't confirm this seat."} Check your boarding passes before trying again.`);
      await refresh();
    } finally { setBusy(false); }
  }
  return <>
    <PageHeader eyebrow="Community transport" title="Free Buses" description="A seat to service. A journey home. Always free." />
    <div className="mb-6 flex items-center gap-4 rounded-[var(--kx-radius-xl)] bg-forest-900 p-5 text-white"><BusFront className="size-8 shrink-0 text-gold-300" /><div><p className="type-card-title">Together, to where we gather.</p><p className="type-meta mt-1 text-white/70">Bus availability updates automatically. No need to refresh.</p></div></div>
    <Card className="mb-6"><div className="grid gap-4 sm:grid-cols-2">
      <Select label="Service name" value={service} onChange={(e) => setService(e.target.value)} options={[{ value: "", label: "All service names" }, { value: "Koinonia", label: "Koinonia Sunday Service" }, { value: "T.G.A", label: "T.G.A" }]} />
      <Select label="Journey" value={direction} onChange={(e) => { setDirection(e.target.value); setPoint(""); }} options={[{ value: "Pickup", label: "To service" }, { value: "Dropoff", label: "Going home" }]} />
      <Select label={direction === "Pickup" ? "Pickup point" : "Drop-off point"} value={point} onChange={(e) => setPoint(e.target.value)} options={[{ value: "", label: "All locations" }, ...points.data.map((p) => ({ value: p.id, label: p.name }))]} />
      <Input label="Service date (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
    </div><p className="type-meta mt-3 text-ink-muted">Outbound and return journeys are booked separately. Service names are matched against the route names set by the admin.</p></Card>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{shown.map((route) => {
      const fleet = assigned(route);
      const seats = fleet.reduce((n, bus) => n + availableCapacity(bus), 0);
      const onGround = fleet.filter(busCanBoard).length;
      const departed = fleet.filter((b) => b.state === "Transit" || b.state === "Arrived").length;
      const reserved = tickets.some((b) => b.route_id === route.id);
      const closed = !seats || !routeCanBook(route);
      return <Card key={route.id} className={closed ? "bg-surface-nested opacity-70" : ""}>
        <StatusChip tone={closed ? "neutral" : "active"}>{closed ? "Unavailable" : `${onGround} buses on ground`}</StatusChip>
        <h2 className="type-card-title mt-4 text-ink">{route.name}</h2><p className="type-body mt-3 text-ink">{location(route.start_point)} → {location(route.end_point)}</p>
        <p className="type-meta mt-3 text-ink-secondary">{route.departure_date} · {route.departure_time} WAT</p>
        <p className="type-meta mt-2 text-ink-muted">{seats} seats available · {departed} of {fleet.length} buses departed</p>
        <p className="type-meta mt-3 text-ink-secondary">{points.data.find((p) => p.id === route.start_point)?.landmark}</p>
        <Button className="mt-5" block icon={Ticket} disabled={closed || reserved} onClick={() => { setActionError(""); setPending(route); }}>{reserved ? "Your seat is booked" : closed ? "No booking available" : "Book a free seat"}</Button>
      </Card>;
    })}</div>
    {!shown.length ? <EmptyState icon={BusFront} title="No free buses match these filters" description="Try another service, date or location. Only published API schedules appear here." /> : null}
    <section className="mt-9"><h2 className="type-section-title mb-4 text-ink">Your boarding passes</h2>
      {!tickets.length ? <p className="type-body text-ink-secondary">Your confirmed bookings will appear here.</p> : <div className="grid gap-4 md:grid-cols-2">{tickets.map((ticket) => {
        const route = allRoutes.data.find((r) => r.id === ticket.route_id);
        const bus = buses.data.find((b) => b.id === ticket.bus_id);
        return <Card key={ticket.id}><div className="flex items-start justify-between gap-3"><h3 className="type-card-title text-ink">{route?.name ?? "Booked journey"}</h3><StatusChip tone="active">{ticket.status}</StatusChip></div>
          <p className="type-numeric mt-4 text-3xl font-semibold text-ink">Seat {ticket.seat_number}</p><p className="type-body mt-2 text-ink">Bus {bus?.license_plate ?? ticket.bus_id}</p>
          {route ? <><p className="type-meta mt-3 text-ink-secondary">{location(route.start_point)} → {location(route.end_point)}</p><p className="type-meta mt-2 text-ink-secondary">{route.departure_date} · {route.departure_time} WAT</p></> : null}
          <p className="type-meta mt-3 break-all text-ink-muted">Reference: {ticket.booking_ref}</p>
          {ticket.status === "Confirmed" && bus && busCanBoard(bus) ? <Button className="mt-4" variant="ghost" onClick={() => { setActionError(""); setCancel(ticket); }}>Release seat</Button> : null}
        </Card>;
      })}</div>}
    </section>
    <p className="type-meta mt-8 text-ink-muted">A full bus is not automatically marked departed. The oversight team confirms movement. Push notifications are not connected yet.</p>
    <Modal open={Boolean(pending)} onClose={() => { if (!busy) setPending(null); }} title="Reserve your free seat" footer={<><Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>Go back</Button><Button loading={busy} onClick={reserve}>Confirm free seat</Button></>}>
      <p className="type-body text-ink">{pending?.name}</p><p className="type-meta mt-3 text-ink-secondary">The API assigns the next available seat. Your return journey needs its own booking.</p>{actionError ? <p role="alert" className="mt-4 text-danger-600">{actionError}</p> : null}
    </Modal>
    <ConfirmDialog open={Boolean(cancel)} onClose={() => { if (!busy) setCancel(null); }} title="Release this seat?" description="Another member can book it once the cancellation succeeds." confirmLabel="Release seat" loading={busy} onConfirm={async () => {
      if (!cancel) return; setBusy(true);
      try { await freebusRequest(`bookings/${cancel.id}`, { method: "DELETE" }); setCancel(null); await refresh(); toast({ title: "Seat released" }); }
      catch (error) { toast({ title: error instanceof Error ? error.message : "Cancellation failed", tone: "danger" }); await refresh(); }
      finally { setBusy(false); }
    }} />
  </>;
}
