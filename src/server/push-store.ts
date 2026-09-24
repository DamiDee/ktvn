/**
 * In-memory push subscription store.
 * In production, replace with a database (e.g. Redis, Postgres).
 * Subscriptions are indexed by endpoint so duplicates are ignored.
 */
import type { PushSubscription } from "web-push";

const store = new Map<string, PushSubscription>();

export const subscriptionStore = {
  add(sub: PushSubscription) {
    store.set(sub.endpoint, sub);
  },
  remove(endpoint: string) {
    store.delete(endpoint);
  },
  all(): PushSubscription[] {
    return [...store.values()];
  },
};
