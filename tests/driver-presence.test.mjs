import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { create } from 'zustand';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'Node', 'HTMLElement']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const h = React.createElement;
function load(path, dependencies) {
  const file = new URL(`../src/features/paid-rides/${path}`, import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = new Module(file.pathname), baseRequire = Module.createRequire(file);
  module.require = (name) => name in dependencies ? dependencies[name] : baseRequire(name);
  module._compile(compiled, file.pathname); return module.exports;
}
let stop = async () => {};
afterEach(async () => { await stop(); document.body.replaceChildren(); });
async function mount(Component) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(h(Component)));
  stop = async () => { await act(async () => root.unmount()); host.remove(); };
  return host;
}
async function flush(callback = () => {}) { await act(async () => { await callback(); await Promise.resolve(); await Promise.resolve(); }); }
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
function fixture({ availability = 'ONLINE', connection = 'open', recover, request, update } = {}) {
  let current = true;
  const calls = { recover: 0, publish: [], retry: 0, notifications: 0 };
  const fix = { point: { lat: 9.06, lng: 7.49 }, timestamp: Date.now(), accuracyMeters: 15, heading: 0, speedMps: 0 };
  const driver = create(() => ({
    state: { availability, ride: { connection, ride: null, resyncToken: 0 } },
    refresh: async () => {},
    recoverConnection: async () => { calls.recover++; return recover ? recover() : true; },
    rideDispatch: (event) => { if (event.type === 'CONNECTION') driver.setState((s) => ({ state: { ...s.state, ride: { ...s.state.ride, connection: event.status } } })); },
    setOnline: async (online) => driver.setState((s) => ({ state: { ...s.state, availability: online ? 'ONLINE' : 'OFFLINE' } })),
  }));
  const presence = create(() => ({ phase: 'idle', error: null }));
  const location = create(() => ({ fix, status: 'granted', request: request ?? (async () => fix) }));
  const client = { get status() { return driver.getState().state.ride.connection; }, onEvent: () => () => {}, onStatus: () => () => {}, onReconnected: () => () => {}, connect() {}, disconnect() {}, subscribeToDriver() {}, unsubscribeFromDriver() {}, subscribeToRide() {}, unsubscribeFromRide() {}, reconnectNow() { calls.retry++; } };
  const dependencies = {
    '@/lib/account-session': { accountSession: { capture: () => ({ isCurrent: () => current }), isBlocked: () => false } },
    '../config': { STORAGE_KEYS: {}, PAID_RIDES_CONFIG: { location: { maxFixAgeMs: 30000 } } },
    '../domain/ride-status': { isLive: (status) => status === 'IN_PROGRESS' },
    '../hooks/use-lifecycle-recovery': { useLifecycleRecovery() {} },
    '../hooks/use-wake-lock': { useWakeLock: () => 'active' },
    '../realtime': { getRealtimeClient: () => client },
    '../location/use-location': { useDriverLocationReporter() {} },
    '../location/location-store': { useLocationStore: location },
    './driver-store': { useDriverStore: driver },
    './passenger-store': { usePassengerStore() {} },
    './driver-presence-store': { useDriverPresenceStore: presence },
    '../services': { getRideService: () => ({ updateDriverLocation: async (point) => { calls.publish.push(point); await update?.(point); } }) },
  };
  const { useDriverSession } = load('state/use-ride-sessions.ts', dependencies);
  const Session = () => { useDriverSession(); return null; };
  const set = (next) => driver.setState((s) => ({ state: { ...s.state, ...next } }));
  const Guard = load('driver/driver-connection-guard.tsx', {
    ...dependencies,
    '../state/driver-store': { useDriverStore: driver },
    '../state/driver-presence-store': { useDriverPresenceStore: presence },
    '../notifications/ride-notifications': { notifyRide: async () => { calls.notifications++; } },
    '@/components/ui/modal': { Modal: ({ open, title, description, children, footer }) => open ? h('div', { role: 'dialog' }, title, description, children, footer) : null },
    '@/components/ui/button': { Button: ({ children, variant, size, ...props }) => h('button', props, children) },
  }).DriverConnectionGuard;
  return { Session, Guard, driver, presence, location, calls, fix, set, expire: () => { current = false; } };
}

test('an open socket is only ready after availability recovery and a confirmed fresh location write', async () => {
  const gate = deferred();
  const f = fixture({ update: () => gate.promise });
  await mount(f.Session);
  assert.equal(f.presence.getState().phase, 'syncing');
  assert.equal(f.calls.publish.length, 1);
  assert.equal(f.calls.publish[0].recordedAt, new Date(f.fix.timestamp).toISOString());
  await flush(() => gate.resolve());
  assert.equal(f.presence.getState().phase, 'ready');
});

test('going online after the socket opened reruns presence registration', async () => {
  const f = fixture({ availability: 'OFFLINE' }); await mount(f.Session);
  assert.equal(f.calls.publish.length, 0);
  await flush(() => f.set({ availability: 'GOING_ONLINE' }));
  await flush(() => f.set({ availability: 'ONLINE' }));
  assert.equal(f.calls.recover, 2);
  assert.equal(f.calls.publish.length, 1);
  assert.equal(f.presence.getState().phase, 'ready');
});

test('a lost connection clears readiness and reconnect publishes again without toggling availability', async () => {
  const f = fixture(); await mount(f.Session);
  await flush(() => f.set({ ride: { ...f.driver.getState().state.ride, connection: 'reconnecting' } }));
  assert.equal(f.presence.getState().phase, 'idle');
  await flush(() => f.set({ ride: { ...f.driver.getState().state.ride, connection: 'open' } }));
  assert.equal(f.calls.publish.length, 2);
  assert.equal(f.driver.getState().state.availability, 'ONLINE');
});

test('failed or stale location writes never mark the driver ready', async () => {
  const f = fixture({ request: async () => ({ point: { lat: 9, lng: 7 }, timestamp: Date.now() - 60000 }) });
  await mount(f.Session);
  assert.equal(f.presence.getState().phase, 'failed');
  assert.equal(f.calls.publish.length, 0);
  assert.match(f.presence.getState().error, /fresh location/);
});

test('manual offline or account changes fence delayed location recovery', async () => {
  const gate = deferred(); const f = fixture({ request: () => gate.promise });
  await mount(f.Session);
  await flush(() => f.set({ availability: 'OFFLINE' }));
  await flush(() => gate.resolve(f.fix));
  assert.equal(f.calls.publish.length, 0);
  f.expire();
  assert.notEqual(f.presence.getState().phase, 'ready');
});

test('idle drivers see a blocking offline notice, it closes on recovery, and intentional offline stays quiet', async () => {
  const f = fixture({ connection: 'reconnecting' }); const host = await mount(f.Guard);
  assert.match(host.querySelector('[role=dialog]').textContent, /You are offline/);
  assert.equal(f.calls.notifications, 1);
  await flush(() => { f.set({ ride: { connection: 'open', ride: null } }); f.presence.setState({ phase: 'ready' }); });
  assert.equal(host.querySelector('[role=dialog]'), null);
  await flush(() => f.set({ availability: 'OFFLINE', ride: { connection: 'offline', ride: null } }));
  assert.equal(host.querySelector('[role=dialog]'), null);
  assert.equal(f.calls.notifications, 1);
});

test('active trips retain access to their controls under a persistent connection warning', async () => {
  const f = fixture({ availability: 'ON_TRIP', connection: 'offline' });
  f.set({ ride: { connection: 'offline', ride: { status: 'IN_PROGRESS' } } });
  const host = await mount(f.Guard);
  assert.equal(host.querySelector('[role=dialog]'), null);
  assert.match(host.querySelector('[role=alert]').textContent, /Safety and navigation remain available/);
  await flush(() => host.querySelector('button').click()); assert.equal(f.calls.retry, 1);
});

test('an unsuccessful HTTP location confirmation keeps recovery visible', async () => {
  const f = fixture({ update: async () => { throw new Error('Location update failed'); } });
  await mount(f.Session);
  assert.equal(f.presence.getState().phase, 'failed');
});

test('a completed location write cannot mark a signed-out account ready', async () => {
  const gate = deferred(), f = fixture({ update: () => gate.promise });
  await mount(f.Session); f.expire();
  await flush(() => gate.resolve());
  assert.notEqual(f.presence.getState().phase, 'ready');
});

test('periodic reconciliation repairs presence while a socket still appears open without flashing the notice', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gate = deferred(); let writes = 0;
  const f = fixture({ update: () => ++writes === 2 ? gate.promise : undefined });
  await mount(f.Session);
  assert.equal(f.presence.getState().phase, 'ready');
  await flush(() => t.mock.timers.tick(20000));
  assert.equal(f.calls.recover, 2); assert.equal(f.calls.publish.length, 2);
  assert.equal(f.presence.getState().phase, 'ready');
  await flush(() => gate.resolve());
});
