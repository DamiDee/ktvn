"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Bell, PictureInPicture2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-media-query";
import { firstName, splitDistance, splitDuration } from "../domain/format";
import type { PassengerPhase } from "../domain/phases";
import type { Ride } from "../domain/types";
import { requestRideNotifications, rideNotificationPermission } from "../notifications/ride-notifications";
import { usePreferencesStore } from "../state/preferences-store";
import { drawTrackerFrame, type TrackerFrame } from "./trip-canvas";
import { PipPortal, pipStrategy, usePictureInPicture } from "./use-picture-in-picture";

/** Ride → the few facts the floating tracker shows. */
export function trackerFrameFor(ride: Ride, phase: PassengerPhase, dark: boolean): TrackerFrame | null {
  const name = ride.driver ? firstName(ride.driver.displayName) : "Driver";
  const vehicle = ride.driverLocation?.point ?? null;
  const heading = ride.driverLocation?.heading ?? null;

  if (phase === "TRIP_ACTIVE" || phase === "TRIP_PAUSED") {
    const eta = splitDuration(ride.progress?.etaSeconds ?? ride.route.durationSeconds);
    return {
      route: ride.route.points,
      vehicle,
      heading,
      target: ride.destination.point,
      targetKind: "destination",
      etaValue: eta.value,
      etaUnit: eta.unit,
      status: `To ${ride.destination.name}`,
      detail: `${splitDistance(ride.progress?.remainingMeters ?? ride.route.distanceMeters).value} ${splitDistance(ride.progress?.remainingMeters ?? ride.route.distanceMeters).unit} left`,
      dark,
    };
  }
  if (phase === "DRIVER_MATCHED" || phase === "DRIVER_EN_ROUTE" || phase === "DRIVER_ARRIVING" || phase === "DRIVER_ARRIVED") {
    const arrived = phase === "DRIVER_ARRIVED";
    const eta = splitDuration(ride.approach?.etaSeconds ?? 0);
    const distance = splitDistance(ride.approach?.distanceMeters ?? 0);
    return {
      route: ride.approach?.route?.points ?? (vehicle ? [vehicle, ride.pickup.point] : [ride.pickup.point]),
      vehicle,
      heading,
      target: ride.pickup.point,
      targetKind: "pickup",
      etaValue: arrived ? "Here" : eta.value,
      etaUnit: arrived ? "" : eta.unit,
      status: arrived ? `${name} has arrived` : phase === "DRIVER_ARRIVING" ? `${name} is arriving` : `${name} is on the way`,
      detail: arrived ? ride.driver?.vehicle.plate ?? "" : `${distance.value} ${distance.unit} away`,
      dark,
    };
  }
  return null;
}

/** Document-PiP contents: minimal, high contrast, one way back. */
function TrackerWindow({ frame, onReturn }: { frame: TrackerFrame; onReturn: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const ratio = element.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    element.width = element.clientWidth * ratio;
    element.height = element.clientHeight * ratio;
    context.scale(ratio, ratio);
    drawTrackerFrame(context, element.clientWidth, element.clientHeight, frame, false);
  }, [frame]);

  return (
    <div className="kx-rides flex h-screen flex-col bg-[var(--surface-primary)] p-3 text-[var(--text-primary)]" style={{ position: "static" }}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.875rem] font-semibold">{frame.status}</p>
          <p className="truncate text-[0.75rem] text-[var(--text-secondary)]">{frame.detail}</p>
        </div>
        <p className="ride-num shrink-0 leading-none">
          <span className="text-[2rem] font-semibold tracking-[-0.04em]">{frame.etaValue}</span>
          <span className="ml-1 text-[0.875rem] text-[var(--text-secondary)]">{frame.etaUnit}</span>
        </p>
      </div>
      <canvas ref={canvas} className="mt-2 min-h-0 w-full flex-1 rounded-[12px]" aria-hidden />
      <button type="button" onClick={onReturn} className="mt-2 h-9 rounded-full bg-[var(--ride-primary)] text-[0.8125rem] font-semibold text-[var(--ride-on-primary)]">
        Back to trip
      </button>
    </div>
  );
}

interface PipControls {
  strategy: "document" | "video" | "none";
  mode: ReturnType<typeof usePictureInPicture>["mode"];
  enable: () => Promise<boolean>;
}

const PipContext = createContext<PipControls | null>(null);

/**
 * Owns the floating window for the whole ride screen, so it survives phase
 * changes (approach → trip) and closes when the ride ends or the screen
 * unmounts. Panels render the prompt through `PipPromptCard`.
 */
export function PictureInPictureHost({ frame, children }: { frame: TrackerFrame | null; children: ReactNode }) {
  const mounted = useMounted();
  const pip = usePictureInPicture(frame);
  const { close } = pip;

  useEffect(() => {
    if (!frame) close();
  }, [frame, close]);

  const value = useMemo<PipControls>(
    () => ({ strategy: mounted ? pipStrategy() : "none", mode: pip.mode, enable: pip.enable }),
    [mounted, pip.mode, pip.enable],
  );

  return (
    <PipContext.Provider value={value}>
      {children}
      {pip.mode === "document" && frame ? (
        <PipPortal pipWindow={pip.pipWindow}>
          <TrackerWindow
            frame={frame}
            onReturn={() => {
              window.focus();
              close();
            }}
          />
        </PipPortal>
      ) : null}
    </PipContext.Provider>
  );
}

/**
 * "Keep your ride visible" — offers PiP where the browser supports it and an
 * honest alternative (alerts) where it doesn't. Shown until dismissed.
 */
export function PipPromptCard() {
  const controls = useContext(PipContext);
  const mounted = useMounted();
  const dismissed = usePreferencesStore((state) => state.pipPromptDismissed);
  const dismiss = usePreferencesStore((state) => state.dismissPipPrompt);
  const notificationState = mounted ? rideNotificationPermission() : "unsupported";

  if (!controls || !mounted || dismissed || controls.mode) return null;
  const supported = controls.strategy !== "none";
  if (!supported && notificationState !== "default") return null;

  return (
    <div className="flex items-start gap-3 rounded-[var(--ride-radius-lg)] border border-[var(--border-subtle)] p-3.5" role="region" aria-label="Keep your ride visible">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ride-brand-soft)] text-[var(--kx-forest-700)] dark:text-[var(--kx-gold-300)]">
        {supported ? <PictureInPicture2 className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="ride-body font-semibold">Keep your ride visible</p>
        <p className="ride-body-sm text-[var(--text-secondary)]">
          {supported
            ? "Keep ETA and live trip progress in a small floating window while you use your phone."
            : "This browser can't float the trip over other apps. Turn on alerts and we'll tell you when your driver is close or arrives."}
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button
            size="sm"
            pill
            onClick={async () => {
              if (supported) await controls.enable();
              else {
                await requestRideNotifications();
                dismiss();
              }
            }}
          >
            {supported ? "Enable" : "Turn on alerts"}
          </Button>
          <Button size="sm" pill variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="kx-tap -mt-1 -mr-1 rounded-full p-1 text-[var(--text-tertiary)]">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Small map control to pop the trip out again after the prompt was dismissed. */
export function usePipControls(): PipControls | null {
  return useContext(PipContext);
}
