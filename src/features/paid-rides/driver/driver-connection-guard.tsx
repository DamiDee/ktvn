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
      void notifyRide("Driver connection interrupted", "K-Rides is restoring your connection. Open the driver screen to check your status.", { tag: "driver-connection", url: "/rides/driver" });
    }
    previous.current = attention;
  }, [attention]);

  const title = disconnected ? "You are offline" : stale || locationStatus === "denied" ? "Your live location is unavailable" : "Restoring your online status";
  const body = disconnected
    ? "Your live connection to K-Rides has been interrupted. New ride requests and live location updates may not reach you. We are reconnecting automatically."
    : locationStatus === "denied"
      ? "Location access is blocked for K-Rides. Allow location access in your browser settings, then retry. Your live location cannot update until access is restored."
      : presence.error ?? (stale && presence.phase === "ready"
        ? "Your location has stopped updating. Keep K-Rides open while we try again, or use Retry connection."
        : "Please keep K-Rides open while we confirm your online status and send your current location.");
  const retry = () => { void useLocationStore.getState().request(); getRealtimeClient().reconnectNow(); };

  if (live) return attention ? <div role="alert" className="absolute inset-x-3 z-[800] mx-auto max-w-lg rounded-2xl border border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-lg" style={{ top: "calc(var(--ride-safe-top) + 12px)" }}>
    <p className="flex items-center gap-2 font-semibold"><WifiOff className="size-5 shrink-0" aria-hidden />{title}</p>
    <p className="mt-2 text-sm">{body} Your trip is still active. Safety and navigation remain available.</p>
    <Button size="sm" variant="secondary" className="mt-3" onClick={retry}>Retry connection</Button>
  </div> : null;

  return <Modal open={attention} onClose={() => undefined} dismissible={false} sheetOnMobile={false} size="sm" title={<span className="flex items-center gap-2"><WifiOff className="size-5 shrink-0" aria-hidden />{title}</span>} description={body}
    footer={<div className="flex flex-wrap gap-2"><Button onClick={retry}>Retry connection</Button><Button variant="ghost" disabled={state.availability === "GOING_ONLINE"} onClick={() => void useDriverStore.getState().setOnline(false)}>Go offline</Button></div>}>
    <p role="status" className="text-sm text-[var(--text-secondary)]">This notice closes automatically when your connection and location are restored.</p>
  </Modal>;
}
