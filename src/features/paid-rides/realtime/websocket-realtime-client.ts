import { PAID_RIDES_CONFIG } from "../config";
import { backoffDelay } from "../domain/location-policy";
import type { ConnectionStatus, LiveLocation, RideEvent } from "../domain/types";
import { ListenerSet, type RideRealtimeClient } from "./realtime-client";

/**
 * Native WebSocket implementation.
 *
 * Wire format (JSON, one object per frame) — see the backend requirements:
 *   client → server  { type: "subscribe" | "unsubscribe", channel: "ride:<id>" | "driver" }
 *                    { type: "location", location }   { type: "typing", rideId, typing }
 *                    { type: "ping" }
 *   server → client  { type: "event", event: RideEvent }   { type: "pong" }
 *
 * The socket authenticates with the same HTTP-only session cookie as REST;
 * no token is put in the URL.
 */

type ServerFrame = { type: "event"; event: RideEvent } | { type: "pong" } | { type: string };

export class WebSocketRealtimeClient implements RideRealtimeClient {
  private socket: WebSocket | null = null;
  private readonly channels = new Set<string>();
  private readonly events = new ListenerSet<[RideEvent]>();
  private readonly statuses = new ListenerSet<[ConnectionStatus]>();
  private readonly reconnects = new ListenerSet<[]>();
  private currentStatus: ConnectionStatus = "idle";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private wanted = false;
  private everConnected = false;
  private readonly url: string;

  constructor(url: string = PAID_RIDES_CONFIG.realtimeUrl) {
    this.url = url;
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
      if (frame.type === "event" && "event" in frame) this.events.emit(frame.event as RideEvent);
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      if (this.socket === socket) this.socket = null;
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
    this.stopHeartbeat();
    this.socket?.close(1000, "client closed");
    this.socket = null;
    this.setStatus("idle");
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

  subscribeToDriver(): void {
    this.subscribe("driver");
  }

  unsubscribeFromDriver(): void {
    this.unsubscribe("driver");
  }

  sendLocation(location: LiveLocation): boolean {
    return this.send({ type: "location", location });
  }

  sendTyping(rideId: string, typing: boolean): void {
    this.send({ type: "typing", rideId, typing });
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
