"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, LocateFixed, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { PAID_RIDES_CONFIG } from "../config";
import type { ConnectionStatus } from "../domain/types";

/**
 * Small overlays that sit on the map: the connection pill, map controls and
 * the screen-reader announcer for ride status.
 */

type PillState = "hidden" | "connecting" | "reconnecting" | "offline" | "restored";

/**
 * "Reconnecting…" while the realtime channel is down, "Connection restored"
 * briefly after it returns. The first connection on page load stays silent.
 */
export function ConnectionPill({ status, className }: { status: ConnectionStatus; className?: string }) {
  const [restored, setRestored] = useState(false);
  const [previous, setPrevious] = useState(status);

  if (status !== previous) {
    setPrevious(status);
    if (status === "open" && (previous === "reconnecting" || previous === "offline")) setRestored(true);
  }

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => setRestored(false), PAID_RIDES_CONFIG.restoredNoticeMs);
    return () => clearTimeout(timer);
  }, [restored]);

  const state: PillState =
    status === "offline" ? "offline" : status === "reconnecting" ? "reconnecting" : status === "open" && restored ? "restored" : "hidden";

  const copy = {
    offline: { text: "You're offline · showing last known trip", icon: WifiOff },
    reconnecting: { text: "Reconnecting…", icon: Wifi },
    restored: { text: "Connection restored", icon: Wifi },
    connecting: { text: "Connecting…", icon: Wifi },
    hidden: null,
  }[state];

  return (
    <div className={cn("pointer-events-none flex justify-center", className)} role="status" aria-live="polite">
      <AnimatePresence>
        {copy ? (
          <motion.div
            key={state}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold shadow-[var(--ride-elev-2)] backdrop-blur-xl",
              state === "restored"
                ? "bg-[color-mix(in_srgb,var(--kx-success-500)_92%,transparent)] text-white"
                : state === "offline"
                  ? "bg-[color-mix(in_srgb,var(--kx-graphite-900)_92%,transparent)] text-white"
                  : "bg-[var(--surface-glass)] text-[var(--text-primary)]",
            )}
          >
            <copy.icon className={cn("size-4", state === "reconnecting" && "animate-pulse")} aria-hidden />
            {copy.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function MapControlButton({ label, onClick, icon: Icon = Crosshair, visible = true, className }: {
  label: string;
  onClick: () => void;
  icon?: typeof LocateFixed;
  visible?: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          onClick={onClick}
          aria-label={label}
          className={cn(
            "ride-press pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-[var(--surface-primary)] px-3.5 text-[0.8125rem] font-semibold text-[var(--text-primary)] shadow-[var(--ride-elev-1)]",
            className,
          )}
        >
          <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

/** Announces ride status changes to assistive tech without moving focus. */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
