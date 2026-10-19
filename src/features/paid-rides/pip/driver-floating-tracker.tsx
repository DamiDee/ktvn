"use client";

import { useEffect, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import { useDriverStore } from "../state/driver-store";
import { useLocationStore } from "../location/location-store";
import { PictureInPictureHost, usePipControls } from "./floating-tracker";
import { driverTrackerFrame } from "./driver-tracker-frame";

/** Session-scoped so navigating to requests/account does not close the map. */
export function DriverFloatingTracker() {
  const state = useDriverStore((store) => store.state);
  const fix = useLocationStore((store) => store.fix);
  const [now, setNow] = useState(0);
  const active = driverTrackerFrame(state, fix, now) !== null;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  const frame = driverTrackerFrame(state, fix, now);
  return (
    <PictureInPictureHost frame={frame}>
      {frame ? <FloatMapControl /> : null}
    </PictureInPictureHost>
  );
}

function FloatMapControl() {
  const pip = usePipControls();
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  if (!pip || pip.mode) return null;
  return (
    <div className="absolute left-3 z-40 max-w-48 lg:left-[calc(25rem+2.5rem)]" style={{ top: "calc(var(--ride-safe-top) + 12px)" }}>
      {pip.strategy !== "none" ? (
        <button type="button" disabled={opening} className="flex items-center gap-2 rounded-full bg-[var(--surface-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm" onClick={async () => {
          setOpening(true);
          setFailed(!(await pip.enable()));
          setOpening(false);
        }}>
          <PictureInPicture2 className="size-4" aria-hidden />{opening ? "Opening…" : "Float map"}
        </button>
      ) : null}
      {failed ? <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">Floating map couldn’t open. Keep K-Rides on screen to stay available.</p> : null}
    </div>
  );
}
