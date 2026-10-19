import type { ConnectionStatus, LiveLocation, RideEvent } from "../domain/types";

/**
 * Transport-agnostic realtime channel for Paid Rides.
 *
 * Components never see this; the session hooks do. A WebSocket, Socket.IO,
 * Pusher or Ably adapter only has to implement this interface.
 *
 * Contract:
 * - `connect` is idempotent and reconnects on its own with backoff.
 * - After every (re)connection the client re-sends its subscriptions and
 *   emits `onReconnected`, so the session can fetch an authoritative snapshot
 *   — events missed while disconnected are never assumed to be replayed.
 */
export interface RideRealtimeClient {
  connect(): void;
  disconnect(): void;
  subscribeToRide(rideId: string): void;
  unsubscribeFromRide(rideId: string): void;
  /** Driver channel: offers, availability, assignment. */
  subscribeToDriver(): void;
  unsubscribeFromDriver(): void;
  sendLocation(location: LiveLocation): boolean;
  sendTyping(rideId: string, typing: boolean): void;
  onEvent(listener: (event: RideEvent) => void): () => void;
  onStatus(listener: (status: ConnectionStatus) => void): () => void;
  onReconnected(listener: () => void): () => void;
  /** Skip the backoff wait — used when the network or the tab comes back. */
  reconnectNow(): void;
  /** The browser reported it went offline; show it rather than spinning. */
  markOffline(): void;
  readonly status: ConnectionStatus;
  /** Actual server pong time; absent for adapters without ping/pong. */
  readonly lastHeartbeatReplyAt?: number | null;
}

/** Small helper so implementations share listener bookkeeping. */
export class ListenerSet<T extends unknown[]> {
  private readonly listeners = new Set<(...args: T) => void>();

  add(listener: (...args: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(...args: T): void {
    for (const listener of this.listeners) listener(...args);
  }
}
