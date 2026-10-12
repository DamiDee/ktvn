"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getMockRealtimeClient } from "../realtime";
import { getMockBackend } from "../services/ride-mock-service";
import type { DriverScenario } from "../services/mock/mock-backend";
import type { MockScenario } from "../services/mock/mock-timeline";
import { useDriverStore } from "../state/driver-store";
import { usePassengerStore } from "../state/passenger-store";

/**
 * Development-only controls for the simulation. Rendered only when
 * `NEXT_PUBLIC_PAID_RIDES=mock`; it never ships with the API mode.
 */

const PASSENGER_SCENARIOS: Array<{ value: MockScenario; label: string }> = [
  { value: "normal", label: "Normal trip" },
  { value: "slow-match", label: "Slow match" },
  { value: "no-drivers", label: "No drivers" },
  { value: "driver-cancels", label: "Driver cancels" },
  { value: "payment-fails", label: "Payment fails" },
];

const DRIVER_SCENARIOS: Array<{ value: DriverScenario; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "already-taken", label: "Request already taken" },
  { value: "passenger-cancels", label: "Rider cancels" },
];

export function MockDevPanel({ role }: { role: "passenger" | "driver" }) {
  const [open, setOpen] = useState(false);
  const backend = getMockBackend();
  const [scenarios, setScenarios] = useState(() => backend.getScenarios());
  const refreshPassenger = usePassengerStore((store) => store.refreshCurrentRide);
  const refreshDriver = useDriverStore((store) => store.refresh);

  return (
    <div className="pointer-events-none absolute top-[calc(var(--ride-safe-top)+0.75rem)] right-3 z-40 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="ride-press pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--surface-glass)] px-3 text-[0.75rem] font-semibold text-[var(--text-secondary)] backdrop-blur-xl"
      >
        <FlaskConical className="size-3.5" aria-hidden />
        Simulation
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            className="pointer-events-auto w-64 rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4 shadow-[var(--ride-elev-4)]"
            role="dialog"
            aria-label="Simulation controls"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="ride-label">Mock mode</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close simulation controls" className="kx-tap rounded-full p-1 text-[var(--text-tertiary)]">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <fieldset className="space-y-1">
              <legend className="ride-caption mb-1.5">{role === "driver" ? "Next request" : "Next ride"}</legend>
              {(role === "driver" ? DRIVER_SCENARIOS : PASSENGER_SCENARIOS).map((option) => {
                const checked = role === "driver" ? scenarios.driver === option.value : scenarios.passenger === option.value;
                return (
                  <label key={option.value} className={cn("flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 ride-body-sm", checked && "bg-[var(--surface-secondary)] font-semibold")}>
                    <input
                      type="radio"
                      name={`scenario-${role}`}
                      checked={checked}
                      onChange={() => {
                        if (role === "driver") backend.setDriverScenario(option.value as DriverScenario);
                        else backend.setScenario(option.value as MockScenario);
                        setScenarios(backend.getScenarios());
                      }}
                    />
                    {option.label}
                  </label>
                );
              })}
            </fieldset>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => getMockRealtimeClient()?.simulateDrop(8_000)}
                className="ride-press h-10 rounded-full bg-[var(--surface-secondary)] text-[0.8125rem] font-semibold"
              >
                Drop connection for 8 s
              </button>
              <button
                type="button"
                onClick={() => {
                  backend.reset();
                  setScenarios(backend.getScenarios());
                  void (role === "driver" ? refreshDriver() : refreshPassenger());
                }}
                className="ride-press h-10 rounded-full text-[0.8125rem] font-semibold text-[var(--ride-danger)]"
              >
                Reset simulation
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
