"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Registers the service worker and manages the user's push subscription.
 * Call `subscribe()` when the user explicitly opts in.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Resolved inside the async body so the effect never sets state synchronously.
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        swRef.current = reg;
        const perm = Notification.permission;
        if (perm === "denied") { setState("denied"); return; }
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setState(existing ? "subscribed" : "unsubscribed");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    if (!swRef.current || !VAPID_PUBLIC_KEY) return;
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }
      const sub = await swRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState("subscribed");
    } catch {
      setState("unsubscribed");
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!swRef.current) return;
    setState("loading");
    try {
      const sub = await swRef.current.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch {
      setState("unsubscribed");
    }
  }, []);

  return { state, subscribe, unsubscribe };
}

/** Fire-and-forget: sends a push to all subscribed members via the internal API. */
export async function broadcastPush(payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-critical — UI action already completed.
  }
}
