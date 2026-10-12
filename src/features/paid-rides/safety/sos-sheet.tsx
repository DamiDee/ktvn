"use client";

import { useState } from "react";
import { HeartPulse, Car, ShieldAlert, CircleHelp, Phone, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { PAID_RIDES_CONFIG, PAID_RIDES_MODE } from "../config";
import { trackRideEvent } from "../analytics";
import { ERROR_COPY, toRideError, type RideErrorCode } from "../domain/errors";
import type { EmergencyType, Ride } from "../domain/types";
import { useLocationStore } from "../location/location-store";
import { getRideService } from "../services";
import { HoldButton } from "../components/hold-button";

/**
 * Emergency sheet. Two clearly separate actions:
 *
 * 1. Call emergency services — a plain `tel:` link, one tap, always works.
 * 2. Alert the K-Rides safety team — press and hold, then sent with ride id,
 *    type, last known location and time. Never sent silently, and never sent
 *    at all until the backend endpoint exists (`sosEndpointAvailable`).
 */

const TYPES: Array<{ value: EmergencyType; label: string; icon: typeof HeartPulse }> = [
  { value: "threat", label: "I feel unsafe", icon: ShieldAlert },
  { value: "medical", label: "Medical", icon: HeartPulse },
  { value: "accident", label: "Accident", icon: Car },
  { value: "other", label: "Something else", icon: CircleHelp },
];

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "failed"; code: RideErrorCode };

export function SosSheet({ ride, open, onClose, acknowledged }: { ride: Ride; open: boolean; onClose: () => void; acknowledged: boolean }) {
  const [type, setType] = useState<EmergencyType>("threat");
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const fix = useLocationStore((store) => store.fix);
  const alertsAvailable = PAID_RIDES_MODE === "mock" || PAID_RIDES_CONFIG.sosEndpointAvailable;

  async function send() {
    setState({ kind: "sending" });
    try {
      await getRideService().triggerSos(
        { rideId: ride.id, type, location: fix?.point ?? ride.driverLocation?.point ?? null },
        // Same ride + type is one alert, however many times it's retried.
        { idempotencyKey: `sos:${ride.id}:${type}` },
      );
      trackRideEvent("sos_sent", { type });
      setState({ kind: "sent" });
    } catch (error) {
      setState({ kind: "failed", code: toRideError(error).code });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Emergency help" description="Choose what's happening. Calling emergency services is always the fastest option." size="sm">
      <div className="space-y-5">
        <a
          href={`tel:${PAID_RIDES_CONFIG.emergencyNumber}`}
          className="ride-press flex h-16 items-center justify-center gap-3 rounded-full border-2 border-[var(--ride-sos)] text-[1.0625rem] font-semibold text-[var(--ride-sos)]"
        >
          <Phone className="size-5" aria-hidden />
          Call emergency services ({PAID_RIDES_CONFIG.emergencyNumber})
        </a>

        <div>
          <p className="ride-label mb-2">Alert the K-Rides safety team</p>
          {state.kind === "sent" ? (
            <div role="status" className="flex items-start gap-3 rounded-[var(--ride-radius-md)] bg-[var(--kx-success-50)] p-4 text-[var(--kx-success-700)] dark:bg-[color-mix(in_srgb,var(--kx-success-500)_16%,transparent)] dark:text-green-200">
              <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="ride-body-sm">
                <p className="font-semibold">{acknowledged ? "The safety team has your alert" : "Alert sent"}</p>
                <p>
                  {acknowledged
                    ? "Someone is looking at your trip now and will call you. Stay on the line if you've called 112."
                    : "Your trip, location and the time were shared. Waiting for the team to confirm…"}
                </p>
              </div>
            </div>
          ) : !alertsAvailable ? (
            <p className="ride-body-sm rounded-[var(--ride-radius-md)] bg-[var(--surface-secondary)] p-4 text-[var(--text-secondary)]">
              In-app safety alerts aren&apos;t switched on yet. Please call {PAID_RIDES_CONFIG.emergencyNumber}.
            </p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Type of emergency" className="mb-4 grid grid-cols-2 gap-2">
                {TYPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={type === option.value}
                    onClick={() => setType(option.value)}
                    className={cn(
                      "ride-press flex min-h-12 items-center gap-2 rounded-[var(--ride-radius-md)] border px-3 py-2.5 text-left text-[0.875rem] font-medium",
                      type === option.value ? "border-[var(--ride-sos)] bg-[color-mix(in_srgb,var(--ride-sos)_8%,transparent)] font-semibold" : "border-[var(--border-subtle)]",
                    )}
                  >
                    <option.icon className="size-4 shrink-0" aria-hidden />
                    {option.label}
                  </button>
                ))}
              </div>
              <HoldButton holdMs={PAID_RIDES_CONFIG.sosHoldMs} onConfirm={() => void send()} disabled={state.kind === "sending"} hint="Press and hold to send your trip and location to the safety team.">
                {state.kind === "sending" ? "Sending alert…" : "Hold to send alert"}
              </HoldButton>
              {state.kind === "failed" ? (
                <p role="alert" className="ride-body-sm mt-3 text-[var(--ride-danger)]">
                  {state.code === "not_supported" ? `Alerts aren't available yet. Call ${PAID_RIDES_CONFIG.emergencyNumber}.` : `${ERROR_COPY[state.code].title}. Try again or call ${PAID_RIDES_CONFIG.emergencyNumber}.`}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
