"use client";

import { getRideCapabilities } from "../capabilities";

/**
 * Local ride notifications for moments that matter while the tab is in the
 * background (driver close, arrived, trip started, new message).
 *
 * Permission is never requested on load: `requestRideNotifications` is only
 * called from the explained, opt-in prompt. Server push (when the tab is
 * closed entirely) reuses the app's existing Web Push service worker.
 */

export type RideNotificationPermission = "unsupported" | "default" | "granted" | "denied";

export function rideNotificationPermission(): RideNotificationPermission {
  if (!getRideCapabilities().notifications) return "unsupported";
  return Notification.permission;
}

export async function requestRideNotifications(): Promise<RideNotificationPermission> {
  if (!getRideCapabilities().notifications) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function notifyRide(title: string, body: string, options: { tag: string; url?: string } = { tag: "ride" }): Promise<void> {
  if (rideNotificationPermission() !== "granted") return;
  // In the foreground the screen already says it; don't double up.
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  const payload = { body, tag: options.tag, icon: "/images/krides-icon-192.png", badge: "/images/krides-icon-192.png", data: { url: options.url ?? "/rides" } };
  try {
    const registration = getRideCapabilities().serviceWorker ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification(title, payload);
    else new Notification(title, payload);
  } catch {
    // Notifications are an enhancement; the trip state is already on screen.
  }
}
