"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, PhoneCall, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { SOSStatus } from "@/types/enums";
import { SOS_PRESENTATION } from "@/constants/status-presentation";
import { isSosRaised } from "@/lib/state-machines";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { EMERGENCY_CONTACTS } from "@/mocks/safety";

const HOLD_MS = 1400;

/**
 * Hold-to-activate SOS.
 *
 * A hold rather than a tap, so it can't fire from a pocket press, and the fill
 * makes the commitment visible while it happens. Releasing early cancels.
 * Keyboard users hold Space or Enter, which behaves identically.
 *
 * Red is used here and for incidents only.
 */
export function SosButton({
  status,
  onActivate,
  className,
}: {
  status: SOSStatus;
  onActivate: () => void;
  className?: string;
}) {
  const { prefersReduced } = useReducedMotionSafe();
  const [holdProgress, setHoldProgress] = useState(0);
  const frameRef = useRef<number | null>(null);

  const raised = isSosRaised(status);

  const stopHold = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setHoldProgress(0);
  }, []);

  const beginHold = useCallback(() => {
    if (raised) return;

    // Reduced motion: there's no fill to watch, so a press activates directly.
    if (prefersReduced) {
      onActivate();
      return;
    }

    // The guard is scoped to this one gesture, so no ref is needed and there
    // is no latch to reset when the alert is later resolved.
    let fired = false;
    let start: number | null = null;

    function tick(now: number) {
      if (start === null) start = now;
      const next = Math.min(1, (now - start) / HOLD_MS);
      setHoldProgress(next);

      if (next >= 1) {
        if (!fired) {
          fired = true;
          onActivate();
        }
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [raised, prefersReduced, onActivate]);

  // Cancel any in-flight frame on unmount.
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const presentation = SOS_PRESENTATION[status];

  if (raised) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className={cn(
          "flex items-center gap-3 rounded-full bg-sos-500 px-5 py-3.5 text-white",
          className,
        )}
      >
        {status === SOSStatus.RESOLVED ? (
          <ShieldCheck className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
        ) : (
          <span className="relative flex size-4 shrink-0 items-center justify-center">
            <span
              className="absolute inline-flex size-full rounded-full bg-white/50"
              style={{ animation: "kx-pulse-ring 1.8s ease-out infinite" }}
              aria-hidden
            />
            <ShieldAlert className="relative size-4" strokeWidth={2.2} aria-hidden />
          </span>
        )}
        <span className="text-[0.875rem] font-semibold">
          {presentation.label}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="Hold to send an emergency alert"
      onPointerDown={beginHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          beginHold();
        }
      }}
      onKeyUp={stopHold}
      onBlur={stopHold}
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full",
        "bg-sos-500 px-6 py-3.5 text-[0.9375rem] font-semibold text-white select-none",
        "transition-transform duration-[120ms] active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sos-500",
        className,
      )}
    >
      {/* Fill that grows during the hold */}
      <motion.span
        className="absolute inset-y-0 left-0 -z-10 bg-sos-700"
        animate={{ width: `${holdProgress * 100}%` }}
        transition={{ duration: 0.05, ease: "linear" }}
        aria-hidden
      />

      <ShieldAlert className="size-4.5" strokeWidth={2.2} aria-hidden />
      SOS

      <AnimatePresence>
        {holdProgress > 0 && holdProgress < 1 ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="type-micro ml-1 font-medium"
          >
            Hold
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

/** Confirmation panel shown once an alert has been raised. */
export function SosStatusPanel({
  status,
  className,
}: {
  status: SOSStatus;
  className?: string;
}) {
  if (!isSosRaised(status)) return null;

  const presentation = SOS_PRESENTATION[status];
  const resolved = status === SOSStatus.RESOLVED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="assertive"
      className={cn(
        "rounded-[var(--kx-radius-lg)] border p-4",
        resolved
          ? "border-success-500/30 bg-success-50 dark:bg-success-500/10"
          : "border-sos-500/35 bg-sos-50 dark:bg-sos-500/12",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white",
            resolved ? "bg-success-500" : "bg-sos-500",
          )}
        >
          {resolved ? (
            <Check className="size-4.5" strokeWidth={2.6} aria-hidden />
          ) : (
            <ShieldAlert className="size-4.5" strokeWidth={2.2} aria-hidden />
          )}
        </span>

        <div className="min-w-0">
          <p className="type-card-title text-ink">
            {status === SOSStatus.SENT
              ? "Emergency alert sent"
              : presentation.label}
          </p>
          <p className="type-meta mt-1 text-ink-secondary">
            {presentation.detail}
          </p>
          {!resolved ? (
            <p className="type-meta mt-2 text-ink-muted">
              Stay on this screen if you can. Your location keeps updating for
              the safety team.
            </p>
          ) : null}
        </div>
      </div>

      {!resolved ? (
        <div className="mt-4 border-t border-sos-500/20 pt-4">
          <p className="type-micro text-sos-700 dark:text-red-200">
            Emergency contacts alerted
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {EMERGENCY_CONTACTS.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-2.5 rounded-[var(--kx-radius-sm)] bg-white/65 px-3 py-2.5 dark:bg-white/[0.05]"
              >
                <PhoneCall
                  className="size-4 shrink-0 text-sos-600 dark:text-red-300"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="type-meta truncate font-medium text-ink">
                    {contact.name}
                  </p>
                  <p className="type-micro mt-0.5 text-ink-muted">
                    {contact.phone} · Alert delivered
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="type-meta mt-3 text-ink-muted">
            Your live location and journey details were included in the alert.
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
