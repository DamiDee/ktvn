"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, BusFront, Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { useToast } from "@/components/ui/toast";
import { useMounted } from "@/hooks/use-media-query";
import { useSessionStore } from "@/stores/session-store";
import { userService } from "@/services";
import { freeBusService } from "@/services/free-bus-service";
import { existingLegBooking, journeyEndpoints, SERVICE_NAMES } from "@/lib/free-buses";
import type { BusDirection } from "@/types/free-buses";
import { useFreeBuses } from "./use-free-buses";
import { BoardingPass, BusRouteCard, busDate } from "./bus-components";

export function MemberFreeBuses() {
  const mounted = useMounted();
  const role = useSessionStore((s) => s.role);
  const memberId = useSessionStore((s) => s.activeMemberId);
  const allowed = mounted && role === "PASSENGER";
  const { data: state, isLoading, error, refetch } = useFreeBuses(allowed);
  const { data: member } = useQuery({
    queryKey: ["bus-member", memberId], enabled: allowed,
    queryFn: () => memberId ? userService.getPassenger(memberId) : userService.getCurrentPassenger(),
  });
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState("");
  const [direction, setDirection] = useState<BusDirection>("TO_SERVICE");
  const [location, setLocation] = useState("ALL");
  const [bookingRoute, setBookingRoute] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!mounted) return <PageLoader message="Preparing Free Buses" />;
  if (!allowed) return <EmptyState icon={BusFront} title="Free Buses is for members" description="Drivers cannot book seats here. Sign in with a member account to continue." action={<ButtonLink href="/login">Sign in as a member</ButtonLink>} />;
  if (error) return <ErrorState title="We couldn't load Free Buses" description={error.message} onRetry={() => void refetch()} />;
  if (isLoading || !state) return <PageLoader message="Checking bus availability" />;
  const event = state.events.find((item) => item.id === selectedEvent) ?? state.events[0];
  const routes = state.allocations.filter((route) => route.eventId === event?.id && route.direction === direction);
  const shown = routes.filter((route) => location === "ALL" || route.id === location);
  const tickets = state.bookings.filter((booking) => booking.memberId === member?.id && !booking.cancelledAt);
  const pending = state.allocations.find((route) => route.id === bookingRoute);
  const actor = member ? { id: member.id, name: member.fullName, role } : null;

  async function confirmBooking() {
    if (!actor || !pending) return;
    setBusy(true); setActionError("");
    try {
      const booking = await freeBusService.reserve(pending.id, actor);
      await refetch(); setBookingRoute(null);
      toast({ title: `Seat ${booking.seatNumber} is yours`, description: "Your bus assignment and boarding pass are ready below.", tone: "success" });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "We couldn't reserve your seat. Please try again.");
      void refetch();
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Community transport" title="Free Buses" description="A seat to service. A journey home. Always free." />
      <div className="mb-6 flex flex-col gap-5 rounded-[var(--kx-radius-xl)] bg-forest-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10"><BusFront className="size-6 text-gold-300" /></span><div><p className="type-card-title">Together, to where we gather.</p><p className="type-meta mt-1 text-white/65">First come, first served. One seat per member, per direction.</p></div></div>
        <span className="type-meta inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-white/10 px-3 py-2 sm:self-auto"><Ticket className="size-4 text-gold-300" /> No fare · No payment</span>
      </div>

      <Card radius="xl" className="mb-6">
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <Select label="Church service" value={event?.id ?? ""} options={state.events.map((item) => ({ value: item.id, label: `${SERVICE_NAMES[item.service]} · ${busDate(item.date)}` }))} onChange={(e) => { setSelectedEvent(e.target.value); setLocation("ALL"); }} />
          <div><p className="mb-1.5 text-[0.8125rem] font-medium text-ink-secondary">Your journey</p><SegmentedControl label="Journey direction" value={direction} onChange={(value) => { setDirection(value); setLocation("ALL"); }} options={[{ value: "TO_SERVICE", label: "To service" }, { value: "FROM_SERVICE", label: "Going home" }]} /></div>
        </div>
        <div className="mt-5"><Select label={direction === "TO_SERVICE" ? "Where will you board?" : "Where are you going home to?"} value={location} options={[{ value: "ALL", label: direction === "TO_SERVICE" ? "All pickup points" : "All drop-off points" }, ...routes.map((route) => ({ value: route.id, label: route.communityPoint }))]} onChange={(e) => setLocation(e.target.value)} /></div>
        <p className="type-meta mt-3 text-ink-muted">{direction === "TO_SERVICE" ? "Choose a pickup point near you. Your bus takes you to the service venue." : "Board at the service venue and choose your drop-off point. This is a separate booking from your journey to service."}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {event && shown.map((route) => {
          const existing = member ? existingLegBooking(state, member.id, route) : undefined;
          return <BusRouteCard key={route.id} state={state} event={event} route={route} reserved={existing?.allocationId === route.id} bookingBlocked={Boolean(existing) || !member} onBook={() => { setActionError(""); setBookingRoute(route.id); }} />;
        })}
      </div>
      {!shown.length ? <EmptyState icon={BusFront} title="No buses scheduled for this journey yet" description="Check another service or direction. New schedules will appear here when the oversight team adds them." /> : null}

      {tickets.length ? <section className="mt-9" aria-labelledby="bus-passes"><h2 id="bus-passes" className="type-section-title mb-4 text-ink">Your boarding passes</h2><div className="grid gap-4 md:grid-cols-2">{tickets.map((booking) => <BoardingPass key={booking.id} state={state} booking={booking} cancelling={busy && cancelId === booking.id} onCancel={() => setCancelId(booking.id)} />)}</div></section> : null}

      {state.notices.length ? <section className="mt-8" aria-labelledby="bus-updates"><h2 id="bus-updates" className="type-card-title mb-3 flex items-center gap-2 text-ink"><BellRing className="size-4" /> Latest bus updates</h2><div className="space-y-2" aria-live="polite">{state.notices.slice(0, 3).map((notice) => <div key={notice.id} className="rounded-[var(--kx-radius-md)] border border-line bg-surface p-4"><p className="type-meta font-semibold text-ink">{notice.title}</p><p className="type-meta mt-1 text-ink-secondary">{notice.body}</p></div>)}</div></section> : null}

      <Modal open={Boolean(pending)} onClose={() => { if (!busy) setBookingRoute(null); }} title="Reserve your free seat" description="Your seat and bus are assigned as soon as you confirm." footer={<><Button variant="ghost" disabled={busy} onClick={() => setBookingRoute(null)}>Go back</Button><Button icon={Ticket} loading={busy} loadingLabel="Reserving" disabled={!member} onClick={confirmBooking}>Confirm free seat</Button></>}>
        {pending && event ? <><p className="type-body font-medium text-ink">{journeyEndpoints(pending, event).from} → {journeyEndpoints(pending, event).to}</p><p className="type-meta mt-3 text-ink-secondary">{journeyEndpoints(pending, event).meetingPoint}</p><p className="type-meta mt-3 text-ink-muted">One seat for {member?.fullName}. Buses fill in order and depart when full. Book your other direction separately.</p></> : null}
        {actionError ? <p role="alert" className="type-meta mt-4 text-danger-600 dark:text-red-300">{actionError}</p> : null}
      </Modal>
      <ConfirmDialog open={Boolean(cancelId)} onClose={() => { if (!busy) setCancelId(null); }} title="Release this seat?" description="Another member can book it immediately. You can reserve another seat if buses are still available." confirmLabel="Release seat" tone="danger" loading={busy} onConfirm={async () => {
        if (!cancelId || !actor) return;
        setBusy(true);
        try { await freeBusService.cancel(cancelId, actor); await refetch(); setCancelId(null); toast({ title: "Seat released" }); }
        catch (error) { toast({ title: error instanceof Error ? error.message : "Couldn't cancel the seat", tone: "danger" }); }
        finally { setBusy(false); }
      }} />
    </div>
  );
}
