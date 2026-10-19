import { PAID_RIDES_CONFIG } from "@/features/paid-rides/config";
import { backoffDelay } from "@/features/paid-rides/domain/location-policy";
import { parseAdminFrame, type AdminSocketEvent } from "./admin-wire";

export type { AdminSocketEvent };

/**
 * The admin side of the Paid Rides socket (`/rides/ws`).
 *
 * Authenticated by the same HTTP-only `access_token` cookie as REST. Admin
 * and Root may subscribe to `admin:rides` and `admin:safety`, and to any
 * `ride:{id}` channel. Events are hints, not data: every one of them means
 * "refetch this over REST". After a reconnect the listener gets a
 * `resync` so lists are refetched — missed events are never replayed.
 *
 * The server closes a socket after 45 s without traffic, so a ping goes out
 * every 25 s (the doc asks for at least every 30 s).
 */

type Listener = (event: AdminSocketEvent) => void;

const PING_INTERVAL_MS = 25_000;
const ADMIN_CHANNELS = ["admin:rides", "admin:safety"];

class AdminSocket {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly rideChannels = new Map<string, number>();
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectedOnce = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.open();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.close();
    };
  }

  /** Follow one ride while its detail page is open. */
  watchRide(rideId: string): () => void {
    this.rideChannels.set(rideId, (this.rideChannels.get(rideId) ?? 0) + 1);
    this.send({ type: "subscribe", channel: `ride:${rideId}` });
    return () => {
      const count = (this.rideChannels.get(rideId) ?? 1) - 1;
      if (count > 0) {
        this.rideChannels.set(rideId, count);
        return;
      }
      this.rideChannels.delete(rideId);
      this.send({ type: "unsubscribe", channel: `ride:${rideId}` });
    };
  }

  private emit(event: AdminSocketEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private send(frame: object) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(frame));
  }

  private open() {
    const url = PAID_RIDES_CONFIG.realtimeUrl;
    if (!url || typeof WebSocket === "undefined") return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      for (const channel of ADMIN_CHANNELS) this.send({ type: "subscribe", channel });
      for (const rideId of this.rideChannels.keys()) this.send({ type: "subscribe", channel: `ride:${rideId}` });
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_INTERVAL_MS);
      // Anything that happened while disconnected is fetched again.
      if (this.connectedOnce) this.emit({ kind: "resync" });
      this.connectedOnce = true;
    };
    socket.onmessage = (message) => {
      const event = parseAdminFrame(message.data);
      if (event) this.emit(event);
    };
    socket.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.listeners.size === 0) return;
      this.reconnectTimer = setTimeout(() => this.open(), backoffDelay(this.attempt++, PAID_RIDES_CONFIG.reconnect));
    };
    socket.onerror = () => socket.close();
  }

  private close() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
    const socket = this.socket;
    this.socket = null;
    this.connectedOnce = false;
    socket?.close();
  }
}

export const adminSocket = new AdminSocket();
