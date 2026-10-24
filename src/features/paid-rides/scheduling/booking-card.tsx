"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { CalendarClock, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import type { StatusTone } from "@/constants/status-presentation";
import { RouteStops, MetricRow } from "../components/ride-ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatMoney } from "../domain/format";
import { DAY, HOUR, scheduledOptionName, localScheduleTime, resolveScheduleTime, reasonSchema, validateBookingTime, type ScheduledRide, type ScheduleRole, type ScheduledStatus } from "./contract";
const AdminAssignmentForm = dynamic(() => import("./admin-assignment-form"));
export const SCHEDULE_LABEL: Record<ScheduledStatus, string> = { OPEN: "Finding a driver", RESERVED: "Driver confirmed", ACTIVATED: "Ride ready", COMPLETED: "Completed", CANCELLED: "Cancelled", EXPIRED: "No ride available" };
const SCHEDULE_TONE: Record<ScheduledStatus, StatusTone> = { OPEN: "pending", RESERVED: "active", ACTIVATED: "active", COMPLETED: "success", CANCELLED: "neutral", EXPIRED: "neutral" };
export type ScheduleAction = { type: "assign"; driverId: string; version: number } | { type: "accept"; version: number } | { type: "cancel" | "release"; reason: string } | { type: "reschedule"; scheduledAt: string; timezone: string } | { type: "complete" };
export function scheduleDate(at: string | number, timezone: string) { return new Intl.DateTimeFormat("en-NG", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(at)); }
export function scheduleError(error: unknown) {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) return String(error.issues[0]?.message ?? "Check the booking details.");
  return error instanceof Error ? error.message : "That change could not be confirmed. Refresh the booking.";
}
export function BookingCard({ booking, role, driverId, viewerId, assignedToViewer = false, now, demo = false, driverName, passengerName, busy, reviewRequired, onReview, onAction }: {
  booking: ScheduledRide; role: ScheduleRole; driverId?: string; now: number; demo?: boolean; driverName?: string; passengerName?: string;
  viewerId?: string; assignedToViewer?: boolean;
  busy: boolean; reviewRequired?: boolean; onReview?: () => void; onAction: (action: ScheduleAction) => Promise<void>;
}) {
  const [form, setForm] = useState<"cancel" | "release" | "reschedule" | "assign" | null>(null), [reason, setReason] = useState("");
  const [time, setTime] = useState(() => localScheduleTime(Date.parse(booking.scheduledAt) + DAY, booking.timezone));
  const [error, setError] = useState("");
  const [assignmentVersion, setAssignmentVersion] = useState(booking.version);
  const ownsBooking = viewerId === undefined || booking.passengerId === viewerId;
  const editable = ownsBooking && ["OPEN", "RESERVED"].includes(booking.status);
  const assignedDriver = booking.driverId === driverId || assignedToViewer;
  const liveHref = role === "driver" ? "/rides/driver" : "/rides/current";
  return <li className="min-w-0">
    <Card className="h-full space-y-4" radius="xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <div><h3 className="ride-body-sm font-semibold">{scheduleDate(booking.scheduledAt, booking.timezone)}</h3><p className="ride-caption">{booking.timezone}</p></div>
        </div>
        <StatusChip tone={SCHEDULE_TONE[booking.status as ScheduledStatus] ?? "neutral"} dot live={booking.status === "ACTIVATED"}>{SCHEDULE_LABEL[booking.status as ScheduledStatus] ?? booking.status}</StatusChip>
      </div>
      <RouteStops pickup={booking.pickup} destination={booking.destination} compact />
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
        <div><p className="ride-caption">{booking.fareLocked ? "Locked fare" : "Fare"}</p><p className="ride-num text-2xl font-semibold tracking-tight">{formatMoney(booking.total)}</p></div>
        <div className="text-right"><p className="ride-body-sm font-medium">{scheduledOptionName(booking.option)}</p><p className="ride-caption">{Math.ceil(booking.durationSeconds / 60)} min journey</p></div>
      </div>
      <div className="rounded-[var(--kx-radius-md)] bg-surface-nested p-3">
        <p className="ride-body-sm flex items-start gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden /><span className="min-w-0 break-words">Driver: {booking.driverId ? driverName ?? booking.driverId : ["RESERVED", "ACTIVATED", "COMPLETED"].includes(booking.status) ? "Details not provided" : "Not assigned"}</span></p>
        {role === "admin" ? <p className="ride-caption mt-2 break-words">Passenger: {passengerName ?? booking.passengerId}</p> : null}
      </div>
      {booking.status === "RESERVED" ? <p className="ride-caption">Your ride can be activated from 15 minutes before pickup, subject to availability.</p> : null}
      {booking.status === "EXPIRED" ? <p className="ride-caption">Get a fresh quote to schedule another trip.</p> : null}
      {booking.cancellationReason ? <p className="ride-caption break-words">Reason: {booking.cancellationReason}</p> : null}
      <details className="ride-caption"><summary className="cursor-pointer py-1 font-medium text-ink-secondary">Booking details</summary><div className="pt-3"><MetricRow items={[{ label: "Arrival buffer", value: `${booking.bufferMinutes} min` }, { label: "Revision", value: booking.version }]} /></div></details>
    <div className="mt-3 flex flex-wrap gap-2">
      {role === "admin" && !demo && ["OPEN", "RESERVED"].includes(booking.status) && Date.parse(booking.scheduledAt) > now ? <Button pill size="sm" disabled={busy || reviewRequired} onClick={() => { setAssignmentVersion(booking.version); setForm("assign"); }}>{booking.driverId ? "Reassign driver" : "Assign driver"}</Button> : null}
      {role === "driver" && booking.status === "OPEN" ? <Button pill size="sm" disabled={busy || reviewRequired} onClick={() => void onAction({ type: "accept", version: booking.version }).catch(() => {})}>Accept scheduled trip</Button> : null}
      {role === "driver" && booking.status === "RESERVED" && assignedDriver ? <Button pill size="sm" variant="ghost" disabled={busy} onClick={() => { setForm("release"); setError(""); }}>Release reservation</Button> : null}
      {role === "passenger" && editable ? <><Button pill size="sm" variant="secondary" disabled={busy} onClick={() => { setForm("reschedule"); setError(""); }}>Change pickup time</Button><Button pill size="sm" variant="ghost" disabled={busy} onClick={() => { setForm("cancel"); setError(""); }}>Cancel schedule</Button></> : null}
      {reviewRequired ? <Button pill size="sm" variant="secondary" disabled={busy} onClick={onReview}>Review updated request</Button> : null}
      {booking.status === "ACTIVATED" && booking.rideId && !demo && (role === "passenger" && ownsBooking || role === "driver" && assignedDriver) ? <ButtonLink pill size="sm" href={`${liveHref}?rideId=${encodeURIComponent(booking.rideId)}&scheduledRideId=${encodeURIComponent(booking.id)}`}>Open live ride</ButtonLink> : null}
      {demo && booking.status === "ACTIVATED" ? <Button pill size="sm" disabled={busy} onClick={() => void onAction({ type: "complete" }).catch(() => {})}>Simulate completion</Button> : null}
    </div>
    {booking.status === "ACTIVATED" && demo ? <p className="ride-caption break-words">Demo ride activated. No real ride was dispatched.</p> : null}
    {booking.status === "ACTIVATED" && !demo ? <p className="ride-caption mt-2">{booking.rideId ? "Arrival, start, cancellation and completion continue in the live ride." : "Your ride is active. Its live ride link will appear when the server provides it."}</p> : null}
    {reviewRequired ? <p role="alert" className="mt-3 text-sm">The request changed or conflicts with another journey. Review the refreshed details before accepting again.</p> : null}
    {form === "assign" && role === "admin" && !demo ? <AdminAssignmentForm busy={busy} stale={!!reviewRequired || assignmentVersion !== booking.version || Date.parse(booking.scheduledAt) <= now || !["OPEN", "RESERVED"].includes(booking.status)} onAssign={(driverId) => onAction({ type: "assign", driverId, version: assignmentVersion })} onClose={() => setForm(null)} /> : null}
    {form && form !== "assign" ? <form className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-3" onSubmit={async (event) => {
      event.preventDefault(); setError("");
      try {
        if (form === "reschedule") {
          const scheduledAt = resolveScheduleTime(time, booking.timezone);
          validateBookingTime({ scheduledAt, timezone: booking.timezone }, now);
          await onAction({ type: form, scheduledAt, timezone: booking.timezone });
        } else { const parsed = reasonSchema.parse({ reason }); await onAction({ type: form, reason: parsed.reason }); }
        setForm(null); setReason("");
      } catch (e) { setError(scheduleError(e)); }
    }}>
      {form === "reschedule" ? <><p className="ride-body-sm text-ink-secondary">Changing the time releases the driver and requires fresh acceptance. Your route and fare stay locked.</p><Input label={`New pickup time · ${booking.timezone}`} type="datetime-local" required min={localScheduleTime(now + HOUR, booking.timezone)} max={localScheduleTime(now + 30 * DAY, booking.timezone)} value={time} onChange={(e) => setTime(e.target.value)} /></> : <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />}
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      <div className="flex flex-wrap gap-2"><Button pill size="sm" type="submit" loading={busy} loadingLabel="Saving change">Confirm change</Button><Button pill size="sm" type="button" variant="ghost" disabled={busy} onClick={() => setForm(null)}>Keep booking</Button></div>
    </form> : null}
    </Card>
  </li>;
}
