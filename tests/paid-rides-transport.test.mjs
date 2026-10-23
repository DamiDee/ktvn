import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketRealtimeClient } from "../src/features/paid-rides/realtime/websocket-realtime-client.ts";
import { mapPoint, mapLocation, mapMoney, mapFare, mapEstimate, mapRide, mapRideEnvelope, mapContact, mapRealtimeEvent } from "../src/features/paid-rides/services/api-mappers.ts";
import { toRideError } from "../src/features/paid-rides/domain/errors.ts";
import { PAID_RIDES_CONFIG } from "../src/features/paid-rides/config.ts";

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances = [];
  readyState = 0;
  sent = [];
  constructor(url) { this.url = url; FakeSocket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; }
}
function setup(t) {
  const original = globalThis.WebSocket;
  FakeSocket.instances = [];
  globalThis.WebSocket = FakeSocket;
  const client = new WebSocketRealtimeClient({ url: "wss://example.test/rides/ws", heartbeatIntervalMs: 100 });
  t.after(() => { client.disconnect(); globalThis.WebSocket = original; });
  return client;
}

test("driver uses cookie-authenticated common URL and shared ride subscriptions are reference counted", (t) => {
  const client = setup(t);
  client.subscribeToDriver(); client.connect();
  const socket = FakeSocket.instances[0];
  assert.equal(socket.url, "wss://example.test/rides/ws");
  socket.open();
  client.subscribeToRide("ride-1"); client.subscribeToRide("ride-1");
  client.unsubscribeFromRide("ride-1");
  assert.deepEqual(socket.sent, [{ type: "subscribe", channel: "ride:ride-1" }]);
  client.unsubscribeFromRide("ride-1");
  assert.deepEqual(socket.sent[1], { type: "unsubscribe", channel: "ride:ride-1" });
});

test("reconnect restores subscriptions and ignores late callbacks from the old socket", (t) => {
  const client = setup(t); let reconnects = 0;
  client.onReconnected(() => reconnects++);
  client.connect(); const first = FakeSocket.instances[0]; first.open();
  client.subscribeToRide("ride-1"); client.reconnectNow();
  const second = FakeSocket.instances[1]; second.open();
  first.onclose(); first.onopen();
  assert.equal(client.status, "open"); assert.equal(reconnects, 1);
  assert.deepEqual(second.sent, [{ type: "subscribe", channel: "ride:ride-1" }]);
  client.markOffline();
  assert.equal(client.status, "offline"); assert.equal(second.readyState, 3);
});

test("a socket that stops answering pings is closed instead of remaining falsely live", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const client = setup(t); client.connect();
  const socket = FakeSocket.instances[0]; socket.open();
  t.mock.timers.tick(100);
  assert.deepEqual(socket.sent, [{ type: "ping" }]);
  socket.onmessage({ data: '{"type":"pong"}' });
  t.mock.timers.tick(100); assert.equal(client.status, "open");
  t.mock.timers.tick(100); assert.equal(client.status, "reconnecting");
  assert.equal(socket.readyState, 3);
});

test("heartbeat confirmation requires a real pong and is cleared on reconnect", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: 1000 });
  const client = setup(t); client.connect();
  const first = FakeSocket.instances[0]; first.open();
  assert.equal(client.lastHeartbeatReplyAt, null);
  first.onmessage({ data: '{"type":"pong"}' });
  assert.equal(client.lastHeartbeatReplyAt, null);
  t.mock.timers.tick(100);
  assert.equal(client.lastHeartbeatReplyAt, null);
  first.onmessage({ data: '{"type":"pong"}' });
  assert.equal(client.lastHeartbeatReplyAt, 1100);
  t.mock.timers.tick(100);
  assert.equal(client.lastHeartbeatReplyAt, 1100);
  client.reconnectNow();
  assert.equal(client.lastHeartbeatReplyAt, null);
  first.onmessage({ data: '{"type":"pong"}' });
  assert.equal(client.lastHeartbeatReplyAt, null);
});

test("production heartbeat sends a WebSocket ping every five seconds", (t) => {
  assert.equal(PAID_RIDES_CONFIG.heartbeatIntervalMs, 5_000);
  t.mock.timers.enable({ apis: ["setInterval"] });
  const original = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket;
  const client = new WebSocketRealtimeClient({ url: "wss://example.test/rides/ws" });
  t.after(() => { client.disconnect(); globalThis.WebSocket = original; });
  client.connect(); const socket = FakeSocket.instances.at(-1); socket.open();
  t.mock.timers.tick(4999); assert.equal(socket.sent.length, 0);
  t.mock.timers.tick(1); assert.deepEqual(socket.sent, [{ type: "ping" }]);
  socket.onmessage({ data: '{"type":"pong"}' });
  t.mock.timers.tick(5000); assert.equal(socket.sent.length, 2);
});

test("a stuck WebSocket handshake times out and retries without a reload", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const client = setup(t); client.connect();
  const first = FakeSocket.instances[0];
  t.mock.timers.tick(10_000);
  assert.equal(first.readyState, 3);
  assert.equal(client.status, "reconnecting");
  t.mock.timers.tick(2_000);
  assert.equal(FakeSocket.instances.length, 2);
  const second = FakeSocket.instances[1]; second.open();
  first.open(); first.onclose();
  assert.equal(client.status, "open");
  t.mock.timers.tick(10_000);
  assert.equal(second.readyState, 1);
});

test("untrusted coordinates, fares, timestamps and call links fail safely", () => {
  assert.equal(mapPoint({ lat: 91, lng: 7 }), null);
  assert.equal(mapPoint({ lat: 9, lng: -181 }), null);
  assert.equal(mapLocation({ point: { lat: 9, lng: 7 } }), null);
  assert.equal(mapLocation({ point: { lat: 9, lng: 7 }, recordedAt: "bad" }), null);
  assert.equal(mapMoney({ amountMinor: 1.5 }), null);
  assert.equal(mapMoney({ amountMinor: -50 }), null);
  assert.throws(() => mapFare(null), { code: "unavailable" });
  assert.throws(() => mapRide({}), { code: "unavailable" });
  assert.throws(() => mapRideEnvelope({ error: "missing ride" }), { code: "unavailable" });
  assert.throws(() => mapEstimate({}, {}), { code: "unavailable" });
  assert.equal(mapContact({ call: "direct", callHref: "javascript:alert(1)" }).call, "none");
  assert.equal(mapRealtimeEvent({ id: "event", payload: { type: "ride.updated", ride: {} } }, { trustSeq: false }), null);
  assert.equal(toRideError(new DOMException("timeout", "TimeoutError")).code, "timeout");
});

test("scheduled channels share the driver socket, ref-count, deduplicate event IDs and ignore seq zero", (t) => {
  const client = setup(t), events = [];
  client.onScheduledEvent((event) => events.push(event));
  client.subscribeToDriver(); client.connect(); const socket = FakeSocket.instances[0]; socket.open();
  client.subscribeToSchedule("booking-1"); client.subscribeToSchedule("booking-1");
  client.unsubscribeFromSchedule("booking-1");
  assert.deepEqual(socket.sent, [{ type: "subscribe", channel: "scheduled:booking-1" }]);
  const event = (id) => JSON.stringify({ type: "event", event: { id, seq: 0, occurredAt: "2026-10-22T09:00:00Z", payload: { type: "scheduled.resync_required" } } });
  socket.onmessage({ data: event("first") });socket.onmessage({ data: event("first") });socket.onmessage({ data: event("second") });
  assert.deepEqual(events.map((e) => e.id), ["first", "second"]);
  assert.equal(FakeSocket.instances.length, 1);
  client.reconnectNow();const next = FakeSocket.instances[1];next.open();
  assert.deepEqual(next.sent, [{ type: "subscribe", channel: "scheduled:booking-1" }]);
  client.unsubscribeFromSchedule("booking-1");assert.deepEqual(next.sent[1], { type: "unsubscribe", channel: "scheduled:booking-1" });
});
