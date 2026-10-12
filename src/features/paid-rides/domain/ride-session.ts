import type { RideErrorCode } from "./errors.ts";
import { applyLocation, checkSequence, compareSnapshot, rememberEvent } from "./ride-sync.ts";
import type { ConnectionStatus, Ride, RideEvent, RideMessage } from "./types.ts";

/**
 * The client's mirror of one live ride, shared by the passenger and driver
 * stores. It is a reducer so every path that touches the ride — bootstrap,
 * snapshot, socket event, reconnect — goes through the same ordering rules.
 */

export type RideAction = "request" | "cancel" | "arrive" | "start" | "complete" | "rate" | "sos";

export interface RideSessionState {
  bootstrap: "idle" | "loading" | "ready" | "error";
  ride: Ride | null;
  lastSeq: number | null;
  seenEventIds: string[];
  connection: ConnectionStatus;
  /** Incremented when the reducer detects missed events; observers refetch. */
  resyncToken: number;
  pending: RideAction | null;
  error: { action: RideAction | "bootstrap"; code: RideErrorCode } | null;
  typing: boolean;
  /** Chat for the current ride, oldest first. */
  messages: RideMessage[];
  /** Incoming messages not yet seen in the chat view. */
  unread: number;
  sosAcknowledged: boolean;
}

export const initialRideSession: RideSessionState = {
  bootstrap: "idle",
  ride: null,
  lastSeq: null,
  seenEventIds: [],
  connection: "idle",
  resyncToken: 0,
  pending: null,
  error: null,
  typing: false,
  messages: [],
  unread: 0,
  sosAcknowledged: false,
};

export type RideSessionMsg =
  | { type: "BOOTSTRAP_START" }
  | { type: "BOOTSTRAP_SUCCESS"; ride: Ride | null }
  | { type: "BOOTSTRAP_FAILURE"; code: RideErrorCode }
  | { type: "SNAPSHOT"; ride: Ride }
  | { type: "EVENT"; event: RideEvent }
  | { type: "CONNECTION"; status: ConnectionStatus }
  | { type: "ACTION_START"; action: RideAction }
  | { type: "ACTION_SUCCESS"; action: RideAction; ride?: Ride }
  | { type: "ACTION_FAILURE"; action: RideAction; code: RideErrorCode }
  | { type: "CLEAR_ERROR" }
  | { type: "RIDE_DISMISSED" }
  | { type: "MESSAGES_LOADED"; rideId: string; messages: RideMessage[] }
  | { type: "MESSAGE_OPTIMISTIC"; message: RideMessage }
  | { type: "MESSAGE_CONFIRMED"; clientId: string; message: RideMessage }
  | { type: "MESSAGE_FAILED"; clientId: string }
  | { type: "CHAT_VIEWED" };

const STATUS_ORDER: Record<RideMessage["status"], number> = { failed: 0, sending: 1, sent: 2, delivered: 3, read: 4 };

/** Insert or update a message, matching on server id or client id, keeping the furthest delivery state. */
export function upsertMessage(messages: readonly RideMessage[], incoming: RideMessage): RideMessage[] {
  const index = messages.findIndex(
    (message) => message.id === incoming.id || (incoming.clientId !== undefined && message.clientId === incoming.clientId),
  );
  if (index === -1) {
    return [...messages, incoming].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  }
  const existing = messages[index];
  const status = STATUS_ORDER[incoming.status] >= STATUS_ORDER[existing.status] ? incoming.status : existing.status;
  const next = messages.slice();
  next[index] = { ...existing, ...incoming, status };
  return next;
}

function withReceipt(messages: readonly RideMessage[], id: string, status: "delivered" | "read"): RideMessage[] {
  return messages.map((message) =>
    message.id === id && STATUS_ORDER[status] > STATUS_ORDER[message.status] ? { ...message, status } : message,
  );
}

const CLEARED_RIDE_EXTRAS = { lastSeq: null, seenEventIds: [], messages: [], unread: 0, typing: false, sosAcknowledged: false };

function withSnapshot(state: RideSessionState, incoming: Ride): RideSessionState {
  const verdict = compareSnapshot(state.ride, incoming);
  if (verdict === "stale") return state;
  if (verdict === "different-ride") {
    // A new ride replaces the old one only through a snapshot, never an event.
    return { ...state, ...CLEARED_RIDE_EXTRAS, ride: incoming };
  }
  return { ...state, ride: incoming };
}

function withEvent(state: RideSessionState, event: RideEvent): RideSessionState {
  const sequence = checkSequence(state.lastSeq, state.seenEventIds, event);
  if (sequence.duplicate) return state;

  const base: RideSessionState = {
    ...state,
    lastSeq: sequence.nextSeq,
    seenEventIds: rememberEvent(state.seenEventIds, event.id),
    resyncToken: sequence.gap ? state.resyncToken + 1 : state.resyncToken,
  };

  const payload = event.payload;
  const ride = base.ride;
  // Events for some other ride are ignored; a snapshot will introduce it.
  const forThisRide = ride !== null && event.rideId === ride.id;

  switch (payload.type) {
    case "ride.updated":
      return withSnapshot(base, payload.ride);
    case "ride.driver.location_updated":
      return forThisRide ? { ...base, ride: applyLocation(ride, payload.location, payload.approach, payload.progress) } : base;
    case "chat.message.created": {
      if (!forThisRide) return base;
      const known = base.messages.some((message) => message.id === payload.message.id);
      return {
        ...base,
        messages: upsertMessage(base.messages, payload.message),
        unread: !known && payload.message.from === "them" ? base.unread + 1 : base.unread,
        typing: payload.message.from === "them" ? false : base.typing,
      };
    }
    case "chat.message.delivered":
      return forThisRide ? { ...base, messages: withReceipt(base.messages, payload.messageId, "delivered") } : base;
    case "chat.message.read":
      return forThisRide ? { ...base, messages: withReceipt(base.messages, payload.messageId, "read") } : base;
    case "chat.typing.started":
      return forThisRide ? { ...base, typing: true } : base;
    case "chat.typing.stopped":
      return forThisRide ? { ...base, typing: false } : base;
    case "ride.sos.acknowledged":
      return forThisRide ? { ...base, sosAcknowledged: true } : base;
    default:
      // Driver-offer events are handled by the driver reducer.
      return base;
  }
}

export function rideSessionReducer(state: RideSessionState, msg: RideSessionMsg): RideSessionState {
  switch (msg.type) {
    case "BOOTSTRAP_START":
      return { ...state, bootstrap: state.bootstrap === "ready" ? "ready" : "loading" };
    case "BOOTSTRAP_SUCCESS": {
      const next = { ...state, bootstrap: "ready" as const, error: state.error?.action === "bootstrap" ? null : state.error };
      if (!msg.ride) {
        // The server has no live ride. Keep a finished ride on screen so the
        // rider can rate it; drop anything that was still "live" locally.
        const keep = state.ride && (state.ride.status === "COMPLETED" || state.ride.status === "CANCELLED" || state.ride.status === "NO_DRIVERS");
        return keep ? next : { ...next, ride: null };
      }
      return withSnapshot(next, msg.ride);
    }
    case "BOOTSTRAP_FAILURE":
      return { ...state, bootstrap: state.ride ? "ready" : "error", error: { action: "bootstrap", code: msg.code } };
    case "SNAPSHOT":
      return withSnapshot(state, msg.ride);
    case "EVENT":
      return withEvent(state, msg.event);
    case "CONNECTION":
      return state.connection === msg.status ? state : { ...state, connection: msg.status };
    case "ACTION_START":
      // One mutation at a time: a second tap while one is in flight is ignored.
      return state.pending ? state : { ...state, pending: msg.action, error: null };
    case "ACTION_SUCCESS": {
      const cleared = { ...state, pending: state.pending === msg.action ? null : state.pending };
      return msg.ride ? withSnapshot(cleared, msg.ride) : cleared;
    }
    case "ACTION_FAILURE":
      return { ...state, pending: state.pending === msg.action ? null : state.pending, error: { action: msg.action, code: msg.code } };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "RIDE_DISMISSED":
      return { ...state, ...CLEARED_RIDE_EXTRAS, ride: null, error: null };
    case "MESSAGES_LOADED": {
      if (state.ride?.id !== msg.rideId) return state;
      let messages = state.messages;
      for (const message of msg.messages) messages = upsertMessage(messages, message);
      return { ...state, messages };
    }
    case "MESSAGE_OPTIMISTIC":
      return { ...state, messages: upsertMessage(state.messages, msg.message) };
    case "MESSAGE_CONFIRMED":
      return { ...state, messages: upsertMessage(state.messages, { ...msg.message, clientId: msg.clientId }) };
    case "MESSAGE_FAILED":
      return {
        ...state,
        messages: state.messages.map((message) => (message.clientId === msg.clientId ? { ...message, status: "failed" } : message)),
      };
    case "CHAT_VIEWED":
      return state.unread ? { ...state, unread: 0 } : state;
  }
}
