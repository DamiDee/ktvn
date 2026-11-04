"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PAID_RIDES_CONFIG } from "../config";
import { isLive } from "../domain/ride-status";
import { useLocationStore } from "../location/location-store";
import { notifyRide } from "../notifications/ride-notifications";
import { getRealtimeClient } from "../realtime";
import { useDriverStore } from "../state/driver-store";
import { useDriverPresenceStore } from "../state/driver-presence-store";

export function DriverConnectionGuard() {
  const state = useDriverStore((store) => store.state);
  const presence = useDriverPresenceStore();
  const fix = useLocationStore((store) => store.fix);
  const locationStatus = useLocationStore((store) => store.status);
  const [now, setNow] = useState(() => Date.now());
  const expected = state.availability === "ONLINE" || state.availability === "ON_TRIP" || state.availability === "GOING_ONLINE";
  const live = Boolean(state.ride.ride && isLive(state.ride.ride.status));
  const disconnected = state.ride.connection !== "open";
  const stale = !fix || now - fix.timestamp > PAID_RIDES_CONFIG.location.maxFixAgeMs;
  const attention = expected && (disconnected || presence.phase !== "ready" || stale || locationStatus === "denied");
  const previous = useRef(false);

  useEffect(() => {
    if (!expected) return;
    const timer = setInterval(() => setNow(Date.now()), 2_000);
    return () => clearInterval(timer);
  }, [expected]);
  useEffect(() => {
    if (attention && !previous.current) {
      navigator.vibrate?.([180, 90, 180]);
      void notifyRide("Driver connection interrupted", "Reconnecting. Open the driver screen to check your status.", { tag: "driver-connection", url: "/rides/driver" });
    }
    previous.current = attention;
  }, [attention]);

  const title = disconnected ? "Live connection interrupted" : stale || locationStatus === "denied" ? "Your live location is unavailable" : "Restoring your online status";
  const body = disconnected
    ? "Connection lost. Ride requests and location updates may be delayed. Reconnecting…"
    : locationStatus === "unavailable" || locationStatus === "timeout" || locationStatus === "unsupported"
      ? "Location unavailable. Enable location in your device and browser settings, then retry."
    : locationStatus === "denied"
      ? "Location is blocked. Allow access in your browser settings, then retry."
      : presence.error ?? (stale && presence.phase === "ready"
        ? "Location updates stopped. Keep K-Rides open or retry."
        : "You’re marked online, but live tracking isn’t ready. Retry to reconnect.");
  const retry = () => { void useLocationStore.getState().request(); getRealtimeClient().reconnectNow(); };

  if (live) return attention ? <div role="alert" className="absolute inset-x-3 z-[800] mx-auto max-w-lg rounded-2xl border border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-lg" style={{ top: "calc(var(--ride-safe-top) + 12px)" }}>
    <p className="flex items-center gap-2 font-semibold"><WifiOff className="size-5 shrink-0" aria-hidden />{title}</p>
    <p className="mt-2 text-sm">{body} Your trip, safety tools and navigation remain active.</p>
    <Button size="sm" variant="secondary" className="mt-3" onClick={retry}>Retry connection</Button>
  </div> : null;

  return <Modal open={attention} onClose={() => undefined} dismissible={false} sheetOnMobile={false} size="sm" title={<span className="flex items-center gap-2"><WifiOff className="size-5 shrink-0" aria-hidden />{title}</span>} description={body}
    footer={<div className="flex flex-wrap gap-2"><Button onClick={retry}>Retry connection</Button><Button variant="ghost" disabled={state.availability === "GOING_ONLINE"} onClick={() => void useDriverStore.getState().setOnline(false)}>Go offline</Button></div>}>
    <p role="status" className="text-sm text-[var(--text-secondary)]">Closes when live tracking resumes.</p>
  </Modal>;
}
