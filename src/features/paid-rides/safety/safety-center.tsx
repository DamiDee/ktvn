"use client";

import { useState } from "react";
import { ChevronRight, Flag, Phone, Share2, ShieldAlert, Siren, Car } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PAID_RIDES_CONFIG } from "../config";
import { trackRideEvent } from "../analytics";
import { sosAvailable } from "../domain/ride-status";
import type { Ride, SafetyReportCategory } from "../domain/types";
import { getRideService, newIdempotencyKey } from "../services";
import { DriverIdentity, PlateBadge, RouteStops } from "../components/ride-ui";
import { shareTrip } from "./share-trip";
import { SosSheet } from "./sos-sheet";

/**
 * Ride safety centre. The same content renders as a sheet over the trip and
 * as the Safety tab. Actions appear only when the ride and config support
 * them — nothing is a decorative button.
 */
export function SafetyCenter({ ride, role, sosAcknowledged }: { ride: Ride | null; role: "passenger" | "driver"; sosAcknowledged: boolean }) {
  const { toast } = useToast();
  const [sosOpen, setSosOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const live = ride ? sosAvailable(ride.status) : false;

  async function onShare() {
    if (!ride) return;
    const outcome = await shareTrip(ride);
    if (outcome === "copied") toast({ title: "Trip details copied", description: "Paste them to someone you trust.", tone: "success" });
    if (outcome === "failed") toast({ title: "Couldn't share from this browser", tone: "warning" });
  }

  return (
    <div className="space-y-5">
      {live && ride ? (
        <button
          type="button"
          onClick={() => {
            trackRideEvent("sos_opened");
            setSosOpen(true);
          }}
          className="ride-press flex w-full items-center gap-4 rounded-[var(--ride-radius-lg)] bg-[var(--ride-sos)] p-4 text-left text-white shadow-[var(--ride-elev-5)]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/18">
            <Siren className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="ride-heading-md block">Emergency SOS</span>
            <span className="ride-body-sm block text-white/85">Call {PAID_RIDES_CONFIG.emergencyNumber} or alert our safety team</span>
          </span>
          <ChevronRight className="size-5 opacity-80" aria-hidden />
        </button>
      ) : (
        <a
          href={`tel:${PAID_RIDES_CONFIG.emergencyNumber}`}
          className="ride-press flex items-center gap-4 rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)] p-4"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ride-sos)_10%,transparent)] text-[var(--ride-sos)]">
            <Phone className="size-5" aria-hidden />
          </span>
          <span>
            <span className="ride-heading-md block">Emergency services</span>
            <span className="ride-body-sm block text-[var(--text-secondary)]">Call {PAID_RIDES_CONFIG.emergencyNumber}</span>
          </span>
        </a>
      )}

      {ride && live ? (
        <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)]">
          {role === "passenger" ? (
            <SafetyRow icon={Share2} title="Share trip status" subtitle="Send your driver, car and ETA to someone you trust" onClick={onShare} />
          ) : null}
          <SafetyRow icon={Flag} title="Report a safety issue" subtitle="Tell us about something that worried you" onClick={() => setReportOpen(true)} />
        </ul>
      ) : null}

      {ride && role === "passenger" && ride.driver ? (
        <section aria-labelledby="safety-trip-details" className="space-y-4 rounded-[var(--ride-radius-lg)] bg-[var(--surface-secondary)] p-4">
          <h3 id="safety-trip-details" className="ride-label">
            Check before you get in
          </h3>
          <DriverIdentity driver={ride.driver} />
          <p className="ride-body-sm flex items-center gap-2 text-[var(--text-secondary)]">
            <Car className="size-4" aria-hidden /> Make sure the plate matches <PlateBadge plate={ride.driver.vehicle.plate} />
          </p>
          <RouteStops pickup={ride.pickup} destination={ride.destination} compact />
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="ride-label">How we keep rides safe</h3>
        {[
          "Every driver is a verified community member with checked documents and an inspected vehicle.",
          "Your trip is tracked live from pickup to drop-off.",
          "Phone numbers stay private — calls go through a masked line when available.",
        ].map((text) => (
          <p key={text} className="ride-body-sm flex gap-2.5 text-[var(--text-secondary)]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--ride-success)]" aria-hidden />
            {text}
          </p>
        ))}
      </section>

      {ride ? <SosSheet ride={ride} open={sosOpen} onClose={() => setSosOpen(false)} acknowledged={sosAcknowledged} /> : null}
      {ride ? <ReportIssueSheet ride={ride} open={reportOpen} onClose={() => setReportOpen(false)} /> : null}
    </div>
  );
}

function SafetyRow({ icon: Icon, title, subtitle, onClick }: { icon: typeof Flag; title: string; subtitle: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="ride-press flex w-full items-center gap-3.5 p-4 text-left hover:bg-[var(--surface-secondary)]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
          <Icon className="size-[1.05rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="ride-body block font-semibold">{title}</span>
          <span className="ride-caption block">{subtitle}</span>
        </span>
        <ChevronRight className="size-4 text-[var(--text-tertiary)]" aria-hidden />
      </button>
    </li>
  );
}

const REPORT_CATEGORIES: Array<{ value: SafetyReportCategory; label: string }> = [
  { value: "unsafe_driving", label: "Unsafe driving" },
  { value: "harassment", label: "Harassment or threat" },
  { value: "vehicle_mismatch", label: "Car or driver doesn't match" },
  { value: "route_concern", label: "Unexpected route" },
  { value: "other", label: "Something else" },
];

function ReportIssueSheet({ ride, open, onClose }: { ride: Ride; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [category, setCategory] = useState<SafetyReportCategory | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [key] = useState(newIdempotencyKey);

  async function submit() {
    if (!category) return;
    setSending(true);
    try {
      await getRideService().reportSafetyIssue({ rideId: ride.id, category, details: details.trim() || undefined }, { idempotencyKey: key });
      toast({ title: "Report received", description: "Our safety team will follow up.", tone: "success" });
      onClose();
    } catch {
      toast({ title: "Report not sent", description: "Check your connection and try again.", tone: "danger" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a safety issue"
      description="Reports go to the K-Rides safety team, not to your driver."
      size="sm"
      footer={
        <Button block pill size="lg" disabled={!category} loading={sending} loadingLabel="Sending" onClick={() => void submit()}>
          Send report
        </Button>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="What happened?" className="grid gap-2">
          {REPORT_CATEGORIES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={category === option.value}
              onClick={() => setCategory(option.value)}
              className={cn(
                "ride-press min-h-12 rounded-[var(--ride-radius-md)] border px-4 text-left text-[0.9375rem]",
                category === option.value ? "border-[var(--ride-primary)] bg-[color-mix(in_srgb,var(--ride-primary)_10%,transparent)] font-semibold" : "border-[var(--border-subtle)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="ride-body-sm mb-1.5 block font-medium">Anything else? (optional)</span>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 600))}
            rows={3}
            className="w-full rounded-[var(--ride-radius-md)] border border-[var(--border-strong)] bg-[var(--surface-primary)] p-3 text-[0.9375rem] focus:border-[var(--ride-primary)] focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}
