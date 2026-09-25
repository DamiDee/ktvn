"use client";

import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useState } from "react";

/**
 * Compact banner shown to members offering to subscribe to push notifications.
 * Disappears once subscribed or dismissed.
 */
export function PushNotificationBanner() {
  const { state, subscribe, unsubscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if unsupported, denied, still loading, or dismissed
  if (state === "unsupported" || state === "denied" || state === "loading" || dismissed) {
    return null;
  }

  if (state === "subscribed") {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-[var(--kx-radius-xl)] border border-forest-400/30 bg-forest-50 p-4 dark:border-gold-500/20 dark:bg-forest-950/60">
        <div className="flex items-center gap-3">
          <Bell className="size-5 shrink-0 text-forest-600 dark:text-gold-400" aria-hidden />
          <div>
            <p className="type-meta font-medium text-forest-800 dark:text-gold-300">Notifications on</p>
            <p className="type-meta text-forest-700/70 dark:text-gold-400/60">You&rsquo;ll be notified when a bus is available or about to depart.</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={unsubscribe} aria-label="Turn off notifications">
          <BellOff className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-5 flex items-start justify-between gap-3 rounded-[var(--kx-radius-xl)] border border-line bg-surface-nested p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
        <div>
          <p className="type-meta font-medium text-ink">Get notified</p>
          <p className="type-meta mt-0.5 text-ink-secondary">Receive alerts when a free bus is published or is about to leave.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={subscribe} loadingLabel="Enabling…">Enable alerts</Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="kx-tap rounded-lg p-1 text-ink-muted transition-colors hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
