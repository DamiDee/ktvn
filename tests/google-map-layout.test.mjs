import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const key of ['window', 'document', 'KeyboardEvent']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { createRoot } = await import('react-dom/client');
const instances = [];
class LatLng {
  constructor(point) { this.point = point; }
  toJSON() { return this.point; }
}
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Bounds { extend() {} }
class FakeMap {
  constructor(_host, options) {
    this.center = options.center; this.zoom = options.zoom; this.listeners = new Map();
    this.moves = []; this.fits = []; instances.push(this);
  }
  getCenter() { return new LatLng(this.center); }
  getZoom() { return this.zoom; }
  getProjection() {
    return {
      fromLatLngToPoint: (point) => { const p = point.toJSON(); return new Point(p.lng, p.lat); },
      fromPointToLatLng: (point) => new LatLng({ lat: point.y, lng: point.x }),
    };
  }
  addListener(name, callback) {
    const callbacks = this.listeners.get(name) ?? new Set(); callbacks.add(callback); this.listeners.set(name, callbacks);
    return { remove: () => callbacks.delete(callback) };
  }
  fire(name) { for (const callback of [...(this.listeners.get(name) ?? [])]) callback(); }
  moveCamera(camera) {
    this.center = camera.center; this.zoom = camera.zoom; this.moves.push(camera);
    this.fire('center_changed'); this.fire('idle');
  }
  fitBounds(bounds, padding) { this.fits.push({ bounds, padding }); }
  setOptions() {}
}
globalThis.google = { maps: {
  LatLng, Point, LatLngBounds: Bounds,
  event: {
    addListenerOnce(instance, name, callback) {
      const listener = instance.addListener(name, () => { listener.remove(); callback(); }); return listener;
    },
    trigger(instance, name) { instance.fire(name); },
    clearInstanceListeners(instance) { instance.listeners.clear(); },
  },
} };

const file = new URL('../src/features/paid-rides/maps/google-ride-map.tsx', import.meta.url);
const loaded = new Module(file.pathname), baseRequire = Module.createRequire(file);
const dependencies = {
  '../config': { PAID_RIDES_CONFIG: { defaultCenter: { lat: 9, lng: 7 }, defaultZoom: 13 } },
  './google-maps-loader': { loadGoogleLibrary: async () => ({ Map: FakeMap }), onGoogleMapsAuthFailure: () => () => {} },
  './markers': {}, './google-ride-map.css': {},
};
loaded.require = (name) => name in dependencies ? dependencies[name] : baseRequire(name);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file.pathname);
const { GoogleRideMap } = loaded.exports;
let cleanup = async () => {};
afterEach(async () => { await cleanup(); instances.length = 0; document.body.replaceChildren(); });

async function mount(props) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), ref = React.createRef();
  const render = (next) => act(async () => root.render(React.createElement(GoogleRideMap, { className: 'absolute inset-0', ...next, ref })));
  await render(props);
  const map = instances.at(-1);
  await act(async () => map.fire('idle'));
  cleanup = () => act(async () => root.unmount());
  return { host, map, ref, render };
}

test('panels affect camera framing while the Google canvas keeps every screen edge', async () => {
  const insets = { top: 16, left: 456, right: 0, bottom: 0 };
  const { host, map } = await mount({ camera: { kind: 'fit', points: [{ lat: 9, lng: 7 }, { lat: 9.1, lng: 7.1 }] }, cameraKey: 'route', insets });
  const canvas = host.querySelector('[aria-label="Google Maps ride map"]');
  assert.ok(canvas.classList.contains('inset-0'));
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.equal(canvas.style[edge], '');
  assert.deepEqual(map.fits.at(-1).padding, { top: 52, left: 492, right: 36, bottom: 36 });
});

test('a point remains under the visible pickup pin when a phone sheet changes height', async () => {
  const target = { lat: 9.076439, lng: 7.425386 }, reported = [];
  const props = { camera: { kind: 'point', point: target, zoom: 17 }, cameraKey: 'pickup', insets: { top: 64, right: 0, bottom: 400, left: 0 }, onCenterChange: (point) => reported.push(point) };
  const { map, ref, render } = await mount(props);
  const close = (point) => { assert.ok(Math.abs(point.lat - target.lat) < 1e-10); assert.ok(Math.abs(point.lng - target.lng) < 1e-10); };
  assert.notEqual(map.center.lat, target.lat);
  close(reported.at(-1)); close(ref.current.getCenter());
  const count = map.moves.length;
  await render({ ...props, camera: { ...props.camera } });
  assert.equal(map.moves.length, count, 'ordinary parent renders must not reset an explored camera');
  await render({ ...props, insets: { ...props.insets, bottom: 180 } });
  close(reported.at(-1)); close(ref.current.getCenter());
});

test('desktop recenter and fit-all retain the space covered by the side panel', async () => {
  const target = { lat: 9.07, lng: 7.42 }, insets = { top: 16, right: 0, bottom: 0, left: 456 };
  const { map, ref } = await mount({ camera: { kind: 'point', point: target, zoom: 15 }, cameraKey: 'driver', insets });
  assert.ok(map.center.lng < target.lng, 'shift the camera west so the target appears beside the panel');
  await act(async () => ref.current.recenter());
  assert.deepEqual(ref.current.getCenter(), target);
  await act(async () => ref.current.fitRouteBounds([target, { lat: 9.1, lng: 7.5 }]));
  assert.deepEqual(map.fits.at(-1).padding, { top: 64, right: 48, bottom: 48, left: 504 });
});
