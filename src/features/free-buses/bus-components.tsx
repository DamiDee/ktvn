"use client";

import { ArrowDown, BusFront, Check, Clock3, MapPin, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { allocationAvailability, busBookings, DIRECTION_NAMES, journeyEndpoints, SERVICE_NAMES } from "@/lib/free-buses";
import type { BusAllocation, BusBooking, BusServiceEvent, FreeBusState } from "@/types/free-buses";

export function busDate(value: string) {
  return new Date(value.length === 10 ? `${value}T12:00:00+01:00` : value).toLocaleDateString("en-NG", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos",
  });
}

export function busTime(value: string) {
  return new Date(value).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
}

export function RouteEndpoints({ route, event }: { route: BusAllocation; event: BusServiceEvent }) {
  const { from, to } = journeyEndpoints(route, event);
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center pt-1 text-ink-muted" aria-hidden>
        <span className="size-2 rounded-full border-2 border-forest-600 dark:border-gold-400" />
        <span className="my-1 h-6 border-l border-dashed border-line-strong" />
        <MapPin className="size-3.5" />
      </div>
      <div className="min-w-0 space-y-3">
        <div><p className="type-micro text-ink-muted">Board at</p><p className="type-body font-medium text-ink">{from}</p></div>
        <div><p className="type-micro text-ink-muted">Arrive at</p><p className="type-body font-medium text-ink">{to}</p></div>
      </div>
    </div>
  );
}

export function BusRouteCard({ state, route, event, reserved, bookingBlocked, onBook }: {
  state: FreeBusState; route: BusAllocation; event: BusServiceEvent;
  reserved: boolean; bookingBlocked: boolean; onBook: () => void;
}) {
  const availability = allocationAvailability(state, route);
  const closed = availability.remaining === 0;
  const next = route.buses.find((bus) => !bus.departedAt);
  return (
    <Card radius="xl" className={cn("flex h-full flex-col", closed && "bg-surface-nested opacity-60 grayscale")}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-forest-100 text-forest-800 dark:bg-gold-500/15 dark:text-gold-300"><BusFront className="size-5" aria-hidden /></span>
        <StatusChip tone={reserved ? "success" : closed ? "neutral" : "active"} dot>
          {reserved ? "Your seat is booked" : closed ? (availability.total ? "All buses have left" : "No buses scheduled") : `${availability.remaining} of ${availability.total} buses on ground`}
        </StatusChip>
      </div>
      <RouteEndpoints route={route} event={event} />
      <p className="type-meta mt-4 flex items-center gap-2 text-ink-muted"><Clock3 className="size-4 shrink-0" aria-hidden /> {busDate(route.boardingAt)} · {busTime(route.boardingAt)} WAT</p>
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-meta text-ink-secondary">{next ? `${next.model} · ${next.capacity} seats` : "Boarding closed"}</p>
          <p className="type-meta font-semibold text-ink">{availability.seats} seats left</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Bus availability">
          {route.buses.map((bus) => {
            const occupied = busBookings(state, bus.id).length;
            return <span key={bus.id} className={cn("type-micro rounded-full border px-2.5 py-1", bus.departedAt ? "border-line text-ink-muted" : "border-forest-500/25 bg-forest-50 text-forest-800 dark:bg-forest-500/10 dark:text-gold-200")}>
              {bus.label} · {bus.departedAt ? "Left" : `${occupied}/${bus.capacity}`}
            </span>;
          })}
        </div>
      </div>
      <div className="mt-auto pt-5">
        <Button block disabled={closed || reserved || bookingBlocked} icon={reserved ? Check : Ticket} onClick={onBook}>
          {reserved ? "Seat reserved" : closed ? "Unavailable" : bookingBlocked ? "Seat already booked for this leg" : "Book a free seat"}
        </Button>
      </div>
    </Card>
  );
}

export function BoardingPass({ booking, state, onCancel, cancelling }: {
  booking: BusBooking; state: FreeBusState; onCancel: () => void; cancelling: boolean;
}) {
  const route = state.allocations.find((item) => item.id === booking.allocationId)!;
  const event = state.events.find((item) => item.id === route.eventId)!;
  const bus = route.buses.find((item) => item.id === booking.busId)!;
  const endpoints = journeyEndpoints(route, event);
  return (
    <Card radius="xl" className="border-forest-500/25 dark:border-gold-500/25">
      <div className="flex items-center justify-between gap-3">
        <p className="type-micro text-forest-700 dark:text-gold-300">{DIRECTION_NAMES[route.direction]} · {busDate(event.date)}</p>
        <StatusChip tone={bus.departedAt ? "neutral" : "success"}>{bus.departedAt ? "Departed" : "Confirmed"}</StatusChip>
      </div>
      <p className="type-card-title mt-3 text-ink">{SERVICE_NAMES[event.service]}</p>
      <div className="my-4 flex items-center gap-5 rounded-[var(--kx-radius-md)] bg-forest-900 p-4 text-white">
        <BusFront className="size-8 shrink-0 text-gold-300" aria-hidden />
        <div className="flex-1"><p className="type-micro text-white/60">Assigned bus</p><p className="text-xl font-semibold">{bus.label}</p><p className="type-meta text-white/65">{bus.model}</p></div>
        <div className="border-l border-white/20 pl-5 text-right"><p className="type-micro text-white/60">Seat</p><p className="type-numeric text-3xl font-semibold text-gold-300">{booking.seatNumber}</p></div>
      </div>
      <p className="type-meta font-medium text-ink">{endpoints.from}</p>
      <ArrowDown className="my-1 size-3.5 text-ink-muted" aria-hidden />
      <p className="type-meta font-medium text-ink">{endpoints.to}</p>
      <p className="type-meta mt-3 text-ink-secondary">{endpoints.meetingPoint}</p>
      <p className="type-meta mt-2 text-ink-muted">Boarding: {busTime(route.boardingAt)} WAT · {booking.memberName}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line-strong pt-3">
        <span className="type-numeric type-meta font-semibold text-ink">{booking.reference}</span>
        {!bus.departedAt ? <Button variant="ghost" size="sm" onClick={onCancel} loading={cancelling}>Cancel seat</Button> : null}
      </div>
      <p className="type-meta mt-2 text-ink-muted">{bus.departedAt ? "This full bus has been marked as departed." : "Show this pass to the transport steward. Seats are assigned in booking order."}</p>
    </Card>
  );
}
