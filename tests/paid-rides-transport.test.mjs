import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketRealtimeClient } from "../src/features/paid-rides/realtime/websocket-realtime-client.ts";
import { mapPoint, mapLocation, mapMoney, mapFare, mapEstimate, mapRide, mapRideEnvelope, mapContact, mapRealtimeEvent } from "../src/features/paid-rides/services/api-mappers.ts";
import { toRideError } from "../src/features/paid-rides/domain/errors.ts";

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
