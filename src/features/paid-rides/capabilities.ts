/**
 * Browser capability detection for Paid Rides. Every progressive enhancement
 * (PiP, wake lock, share, vibration, notifications) asks here first and the
 * UI degrades instead of failing. Detection is lazy and SSR-safe.
 */

export interface RideCapabilities {
  geolocation: boolean;
  notifications: boolean;
  pushNotifications: boolean;
  serviceWorker: boolean;
  webShare: boolean;
  clipboard: boolean;
  wakeLock: boolean;
  documentPiP: boolean;
  videoPiP: boolean;
  canvasCapture: boolean;
  vibration: boolean;
  standalone: boolean;
}

const NONE: RideCapabilities = {
  geolocation: false,
  notifications: false,
  pushNotifications: false,
  serviceWorker: false,
  webShare: false,
  clipboard: false,
  wakeLock: false,
  documentPiP: false,
  videoPiP: false,
  canvasCapture: false,
  vibration: false,
  standalone: false,
};

let cached: RideCapabilities | null = null;

export function supportsDocumentPiP(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

export function supportsVideoPiP(): boolean {
  return typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled === true;
}

export function supportsCanvasCapture(): boolean {
  return typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

export function supportsPiP(): boolean {
  return supportsDocumentPiP() || (supportsVideoPiP() && supportsCanvasCapture());
}

export function getRideCapabilities(): RideCapabilities {
  if (typeof window === "undefined") return NONE;
  cached ??= {
    geolocation: "geolocation" in navigator,
    notifications: "Notification" in window,
    pushNotifications: "PushManager" in window && "serviceWorker" in navigator,
    serviceWorker: "serviceWorker" in navigator,
    webShare: typeof navigator.share === "function",
    clipboard: typeof navigator.clipboard?.writeText === "function",
    wakeLock: "wakeLock" in navigator,
    documentPiP: supportsDocumentPiP(),
    videoPiP: supportsVideoPiP(),
    canvasCapture: supportsCanvasCapture(),
    vibration: typeof navigator.vibrate === "function",
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
  return cached;
}

/** Haptic-like nudge on supporting devices; silently nothing elsewhere. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw without a recent user gesture.
  }
}
