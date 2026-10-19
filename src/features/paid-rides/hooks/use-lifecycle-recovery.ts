"use client";

import { useEffect, useRef } from "react";

/**
 * Page-lifecycle recovery.
 *
 * Mobile browsers freeze background tabs, drop sockets and restore pages from
 * the back/forward cache. None of that is visible to the app except through
 * these events, so whenever the page comes back we ask the server what is
 * true now instead of trusting what we last saw.
 *
 * `navigator.onLine` is only a hint: `online` triggers a reconnect attempt,
 * `offline` shows the offline state, and the realtime client still decides.
 */
export function useLifecycleRecovery(handlers: { onResume: () => void; onOffline: () => void }) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    let hiddenAt: number | null = null;
    let lastResumeAt: number | null = null;

    const resume = () => {
      const now = Date.now();
      // Mobile browsers emit focus, pageshow and visibilitychange together.
      // Do not repeatedly replace a socket that has just started reconnecting.
      if (lastResumeAt !== null && now - lastResumeAt < 1_000) return;
      lastResumeAt = now;
      latest.current.onResume();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // A glance away for a second doesn't need a round trip.
      if (hiddenAt === null || Date.now() - hiddenAt > 1500) resume();
      hiddenAt = null;
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resume();
    };
    const onOffline = () => { lastResumeAt = null; latest.current.onOffline(); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", resume);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", resume);
    };
  }, []);
}
