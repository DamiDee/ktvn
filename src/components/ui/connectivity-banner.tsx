"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConnectivityState } from "@/types/enums";

/**
 * Non-blocking connectivity banner. Never takes over the screen — journeys
 * stay visible while the connection recovers.
 */
export function ConnectivityBanner({ className }: { className?: string }) {
  const [state, setState] = useState<ConnectivityState>(ConnectivityState.ONLINE);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function goOffline() {
      setState(ConnectivityState.OFFLINE);
      setVisible(true);
    }

    function goOnline() {
      setState(ConnectivityState.RECONNECTING);
      setVisible(true);
      window.setTimeout(() => {
        setState(ConnectivityState.ONLINE);
        window.setTimeout(() => setVisible(false), 2200);
      }, 900);
    }

    if (!navigator.onLine) goOffline();

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const copy: Record<ConnectivityState, string> = {
    [ConnectivityState.OFFLINE]:
      "You're offline. Some journey updates may be delayed.",
    [ConnectivityState.RECONNECTING]: "Reconnecting…",
    [ConnectivityState.ONLINE]: "You're back online.",
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
          aria-live="polite"
          className={cn(
            "pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex w-fit max-w-[92vw] items-center gap-2.5 rounded-full px-4 py-2.5",
            "surface-glass",
            className,
          )}
        >
          {state === ConnectivityState.ONLINE ? (
            <Wifi className="size-4 shrink-0 text-success-500" strokeWidth={1.9} aria-hidden />
          ) : (
            <WifiOff className="size-4 shrink-0 text-ink-muted" strokeWidth={1.9} aria-hidden />
          )}
          <p className="type-meta text-ink">{copy[state]}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
