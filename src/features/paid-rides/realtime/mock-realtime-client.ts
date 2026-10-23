import type { ConnectionStatus, LiveLocation, RideEvent } from "../domain/types";
import { getMockBackend } from "../services/ride-mock-service";
import { ListenerSet, type RideRealtimeClient } from "./realtime-client";

/**
 * Realtime client for `mock` mode. It receives events from the in-browser
 * MockBackend and behaves like a socket: it only delivers subscribed
 * channels, it can be dropped on purpose (dev panel) and it reports
 * reconnection exactly like the WebSocket client, so the reconnect and
 * reconciliation paths are exercised without a server.
 */
export class MockRealtimeClient implements RideRealtimeClient {
  private readonly rides = new Set<string>();
  private driver = false;
  private readonly events = new ListenerSet<[RideEvent]>();
  private readonly statuses = new ListenerSet<[ConnectionStatus]>();
  private readonly reconnects = new ListenerSet<[]>();
  private currentStatus: ConnectionStatus = "idle";
  private detach: (() => void) | null = null;
  private dropTimer: ReturnType<typeof setTimeout> | null = null;
  private dropped = false;
  private everConnected = false;

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.statuses.emit(status);
  }

  connect(): void {
    if (this.detach) return;
    this.setStatus(this.everConnected ? "reconnecting" : "connecting");
    const backend = getMockBackend();
    this.detach = backend.subscribe((event) => this.deliver(event));
    // A real handshake takes a moment; so does this one.
    setTimeout(() => {
      if (!this.detach || this.dropped) return;
      const wasReconnect = this.everConnected;
      this.everConnected = true;
      this.setStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "open");
      if (wasReconnect) this.reconnects.emit();
    }, 350);
  }

  disconnect(): void {
    this.detach?.();
    this.detach = null;
    if (this.dropTimer) clearTimeout(this.dropTimer);
    this.dropTimer = null;
    this.dropped = false;
    this.setStatus("idle");
  }

  reconnectNow(): void {
    if (this.dropped) return;
    if (this.currentStatus === "offline" && typeof navigator !== "undefined" && navigator.onLine) {
      this.setStatus("reconnecting");
      setTimeout(() => {
        this.setStatus("open");
        this.reconnects.emit();
      }, 450);
    } else if (!this.detach) {
      this.connect();
    }
  }

  /** Network went away (window `offline`). */
  markOffline(): void {
    this.setStatus("offline");
  }

  /** Dev panel: drop the "socket" for a while, missing every event meanwhile. */
  simulateDrop(durationMs: number): void {
    if (!this.detach) return;
    this.dropped = true;
    this.setStatus("reconnecting");
    if (this.dropTimer) clearTimeout(this.dropTimer);
    this.dropTimer = setTimeout(() => {
      this.dropTimer = null;
      this.dropped = false;
      this.setStatus("open");
      this.reconnects.emit();
    }, durationMs);
  }

  private deliver(event: RideEvent): void {
    if (this.dropped || this.currentStatus === "offline") return;
    const isDriverEvent = event.payload.type.startsWith("driver.");
    const subscribed = isDriverEvent ? this.driver : event.rideId !== null && this.rides.has(event.rideId);
    if (subscribed) this.events.emit(event);
  }

  subscribeToSchedule(): void {}
  unsubscribeFromSchedule(): void {}
  onScheduledEvent(): () => void { return () => {}; }

  subscribeToRide(rideId: string): void {
    this.rides.add(rideId);
  }

  unsubscribeFromRide(rideId: string): void {
    this.rides.delete(rideId);
  }

  subscribeToDriver(): void {
    this.driver = true;
  }

  unsubscribeFromDriver(): void {
    this.driver = false;
  }

  sendLocation(location: LiveLocation): boolean {
    if (this.currentStatus !== "open") return false;
    getMockBackend().setDriverOrigin(location.point);
    return true;
  }

  sendTyping(): void {
    // The simulated counterpart doesn't react to typing.
  }

  onEvent(listener: (event: RideEvent) => void): () => void {
    return this.events.add(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    return this.statuses.add(listener);
  }

  onReconnected(listener: () => void): () => void {
    return this.reconnects.add(listener);
  }
}
