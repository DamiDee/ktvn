import { signedInUserId } from "@/services/freebus-api";
import { PAID_RIDES_CONFIG, PAID_RIDES_FEATURES } from "../config";
import { backoffDelay } from "../domain/location-policy";
import type { ConnectionStatus, LiveLocation, RideEvent } from "../domain/types";
import { mapRealtimeEvent } from "../services/api-mappers";
import { ListenerSet, type RideRealtimeClient } from "./realtime-client";

/**
 * Native WebSocket implementation for the real backend
 * (docs/paid-rides/API_AND_WEBSOCKET_SPEC.md §2).
 *
 * Endpoints: passengers connect to the bare URL; drivers connect to
 * `<url>/<driverId>`, which registers them for offers. There is no `driver`
 * channel, so "subscribing to the driver feed" means connecting on the
 * driver path.
 *
 * Wire format (JSON, one object per frame):
 *   client → server  { type: "subscribe" | "unsubscribe", channel: "ride:<id>" }
 *                    { type: "location", location }   { type: "ping" }
 *   server → client  { type: "event", event: { id, rideId, seq, rideVersion, occurredAt, payload } }
 *                    { type: "pong" }
 *
 * The socket authenticates with the same HTTP-only `access_token` cookie as
 * REST; no token is put in the URL. Events are mapped and de-duplicated by
 * id; `seq` is ignored unless `PAID_RIDES_CONFIG.trustRealtimeSeq`.
 */

type ServerFrame = { type?: unknown; event?: unknown };

export interface WebSocketClientOptions {
  url?: string;
  /** The signed-in driver's user id; null falls back to the bare URL. */
  driverId?: () => string | null;
}

export class WebSocketRealtimeClient implements RideRealtimeClient {
  private socket: WebSocket | null = null;
  private socketUrl: string | null = null;
  private readonly channels = new Set<string>();
  private readonly events = new ListenerSet<[RideEvent]>();
  private readonly statuses = new ListenerSet<[ConnectionStatus]>();
  private readonly reconnects = new ListenerSet<[]>();
  private currentStatus: ConnectionStatus = "idle";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private switchTimer: ReturnType<typeof setTimeout> | null = null;
  private wanted = false;
  private everConnected = false;
  private asDriver = false;
  private readonly url: string;
  private readonly driverId: () => string | null;

  constructor(options: WebSocketClientOptions = {}) {
    this.url = (options.url ?? PAID_RIDES_CONFIG.realtimeUrl).replace(/\/$/, "");
    this.driverId = options.driverId ?? signedInUserId;
  }

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.statuses.emit(status);
  }

  /** The endpoint for the current role. */
  private targetUrl(): string {
    if (!this.asDriver) return this.url;
    const driverId = this.driverId();
    // TODO(paid-rides): without a remembered user id (Free Buses live login
    // stores it) the driver can't be addressed, so offers won't arrive.
    // `/rides/me` doesn't return the id; ask the backend to take identity
    // from the cookie instead (BACKEND_SPEC_ALIGNMENT.md, "two WebSocket endpoints").
    return driverId ? `${this.url}/${encodeURIComponent(driverId)}` : this.url;
  }

  connect(): void {
    this.wanted = true;
    if (!this.url) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return;
    }

    this.setStatus(this.everConnected ? "reconnecting" : "connecting");
    const url = this.targetUrl();
    const socket = new WebSocket(url);
    this.socket = socket;
    this.socketUrl = url;

    socket.onopen = () => {
      const wasReconnect = this.everConnected;
      this.everConnected = true;
      this.attempt = 0;
      this.setStatus("open");
      for (const channel of this.channels) this.send({ type: "subscribe", channel });
      this.startHeartbeat();
      if (wasReconnect) this.reconnects.emit();
    };

    socket.onmessage = (message) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(String(message.data)) as ServerFrame;
      } catch {
        return;
      }
      if (frame.type !== "event") return;
      const event = mapRealtimeEvent(frame.event, { trustSeq: PAID_RIDES_CONFIG.trustRealtimeSeq });
      if (event) this.events.emit(event);
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      if (this.socket !== socket) return;
      this.socket = null;
      this.socketUrl = null;
      if (this.wanted) this.scheduleReconnect();
      else this.setStatus("idle");
    };

    // onclose always follows onerror; reconnection is handled there.
    socket.onerror = () => undefined;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return;
    }
    this.setStatus("reconnecting");
    const delay = backoffDelay(this.attempt, PAID_RIDES_CONFIG.reconnect);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /** Called by lifecycle hooks when the network or the tab comes back. */
  reconnectNow(): void {
    this.attempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.wanted) this.connect();
  }

  markOffline(): void {
    if (this.wanted) this.setStatus("offline");
  }

  disconnect(): void {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.switchTimer) clearTimeout(this.switchTimer);
    this.switchTimer = null;
    this.stopHeartbeat();
    this.socket?.close(1000, "client closed");
    this.socket = null;
    this.socketUrl = null;
    this.setStatus("idle");
  }

  /**
   * Move the connection to the endpoint for the current role. Deferred one
   * tick so an unsubscribe immediately followed by a subscribe (a React
   * effect re-run) doesn't drop the socket.
   */
  private reconnectForRole(): void {
    if (this.switchTimer) clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => {
      this.switchTimer = null;
      if (!this.wanted || !this.socket || this.socketUrl === this.targetUrl()) return;
      const previous = this.socket;
      this.socket = null;
      this.socketUrl = null;
      this.stopHeartbeat();
      previous.close(1000, "switching endpoint");
      // A deliberate switch is a reconnect: the session re-reads its snapshot.
      this.connect();
    }, 0);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.send({ type: "ping" }), PAID_RIDES_CONFIG.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private send(frame: Record<string, unknown>): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  private subscribe(channel: string): void {
    if (this.channels.has(channel)) return;
    this.channels.add(channel);
    this.send({ type: "subscribe", channel });
  }

  private unsubscribe(channel: string): void {
    if (!this.channels.delete(channel)) return;
    this.send({ type: "unsubscribe", channel });
  }

  subscribeToRide(rideId: string): void {
    this.subscribe(`ride:${rideId}`);
  }

  unsubscribeFromRide(rideId: string): void {
    this.unsubscribe(`ride:${rideId}`);
  }

  /** Offers and availability arrive on the driver endpoint; no channel frame is sent. */
  subscribeToDriver(): void {
    if (this.asDriver) return;
    this.asDriver = true;
    this.reconnectForRole();
  }

  unsubscribeFromDriver(): void {
    if (!this.asDriver) return;
    this.asDriver = false;
    this.reconnectForRole();
  }

  sendLocation(location: LiveLocation): boolean {
    return this.send({ type: "location", location });
  }

  sendTyping(rideId: string, typing: boolean): void {
    // No typing frames on this backend until chat exists.
    if (PAID_RIDES_FEATURES.chat) this.send({ type: "typing", rideId, typing });
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
