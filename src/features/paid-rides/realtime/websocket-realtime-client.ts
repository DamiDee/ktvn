import { PAID_RIDES_CONFIG, PAID_RIDES_FEATURES } from "../config.ts";
import { backoffDelay } from "../domain/location-policy.ts";
import type { ConnectionStatus, LiveLocation, RideEvent } from "../domain/types";
import { mapRealtimeEvent } from "../services/api-mappers.ts";
import { ListenerSet, type RideRealtimeClient } from "./realtime-client.ts";

/**
 * Native WebSocket implementation for the real backend
 * (docs/paid-rides/API_AND_WEBSOCKET_SPEC.md §2).
 *
 * All roles connect to the configured URL. The server derives driver identity
 * from the authenticated cookie and automatically registers their mailbox.
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
  heartbeatIntervalMs?: number;
  connectTimeoutMs?: number;
}

export class WebSocketRealtimeClient implements RideRealtimeClient {
  private socket: WebSocket | null = null;
  private readonly channels = new Map<string, number>();
  private readonly events = new ListenerSet<[RideEvent]>();
  private readonly statuses = new ListenerSet<[ConnectionStatus]>();
  private readonly reconnects = new ListenerSet<[]>();
  private currentStatus: ConnectionStatus = "idle";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly connectTimeoutMs: number;
  private wanted = false;
  private everConnected = false;
  private readonly url: string;
  private readonly heartbeatIntervalMs: number;
  private awaitingPong = false;
  private heartbeatReplyAt: number | null = null;

  get lastHeartbeatReplyAt(): number | null {
    return this.heartbeatReplyAt;
  }

  constructor(options: WebSocketClientOptions = {}) {
    this.url = (options.url ?? PAID_RIDES_CONFIG.realtimeUrl).replace(/\/$/, "");
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? PAID_RIDES_CONFIG.heartbeatIntervalMs;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
  }

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.statuses.emit(status);
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
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.connectTimer = setTimeout(() => {
      if (this.socket !== socket || !this.wanted) return;
      this.closeSocket();
      this.scheduleReconnect();
    }, this.connectTimeoutMs);

    socket.onopen = () => {
      if (this.socket !== socket || !this.wanted) return;
      this.clearConnectTimer();
      const wasReconnect = this.everConnected;
      this.everConnected = true;
      this.attempt = 0;
      this.setStatus("open");
      for (const channel of this.channels.keys()) this.send({ type: "subscribe", channel });
      this.startHeartbeat();
      if (wasReconnect) this.reconnects.emit();
    };

    socket.onmessage = (message) => {
      if (this.socket !== socket || !this.wanted) return;
      let frame: ServerFrame;
      try {
        frame = JSON.parse(String(message.data)) as ServerFrame;
      } catch {
        return;
      }
      if (frame?.type === "pong") {
        if (this.awaitingPong) this.heartbeatReplyAt = Date.now();
        this.awaitingPong = false;
        return;
      }
      if (frame?.type !== "event") return;
      const event = mapRealtimeEvent(frame.event, { trustSeq: PAID_RIDES_CONFIG.trustRealtimeSeq });
      if (event) this.events.emit(event);
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.clearConnectTimer();
      this.stopHeartbeat();
      this.socket = null;
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
    if (this.wanted) {
      this.closeSocket();
      this.connect();
    }
  }

  markOffline(): void {
    if (this.wanted) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.closeSocket();
      this.setStatus("offline");
    }
  }

  disconnect(): void {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.closeSocket();
    this.setStatus("idle");
  }

  private closeSocket(): void {
    this.clearConnectTimer();
    const previous = this.socket;
    this.socket = null;
    this.stopHeartbeat();
    previous?.close(1000, "client reconnect or disconnect");
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.awaitingPong = false;
    this.heartbeatTimer = setInterval(() => {
      if (this.awaitingPong) {
        this.closeSocket();
        if (this.wanted) this.scheduleReconnect();
        return;
      }
      this.awaitingPong = this.send({ type: "ping" });
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.heartbeatReplyAt = null;
  }

  private send(frame: Record<string, unknown>): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(frame));
      return true;
    } catch {
      this.closeSocket();
      if (this.wanted) this.scheduleReconnect();
      return false;
    }
  }

  private subscribe(channel: string): void {
    const count = this.channels.get(channel) ?? 0;
    this.channels.set(channel, count + 1);
    if (count > 0) return;
    this.send({ type: "subscribe", channel });
  }

  private unsubscribe(channel: string): void {
    const count = this.channels.get(channel) ?? 0;
    if (count > 1) { this.channels.set(channel, count - 1); return; }
    if (!this.channels.delete(channel)) return;
    this.send({ type: "unsubscribe", channel });
  }

  subscribeToRide(rideId: string): void {
    this.subscribe(`ride:${rideId}`);
  }

  unsubscribeFromRide(rideId: string): void {
    this.unsubscribe(`ride:${rideId}`);
  }

  /** Driver mailbox is bound to the authenticated identity at upgrade. */
  subscribeToDriver(): void {
    // No driver-id URL or driver channel is required by the current protocol.
  }

  unsubscribeFromDriver(): void {
    // Availability is controlled by REST, not by switching socket endpoints.
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
