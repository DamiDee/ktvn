import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import * as format from "../src/features/paid-rides/domain/format.ts";
import * as contract from "../src/features/paid-rides/scheduling/contract.ts";
import * as scheduleService from "../src/features/paid-rides/scheduling/schedule-service.ts";
import * as passengerSchedules from "../src/features/paid-rides/scheduling/passenger-schedules.ts";
import { useDebouncedValue } from "../src/hooks/use-debounced-value.ts";

// Real React event/state handling with synthetic network responses. This checks
// the Safari blur-before-click sequence; it does not emulate the Safari engine.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const key of ["window", "document", "Node", "HTMLElement", "HTMLInputElement", "Event", "FocusEvent", "MouseEvent"]) {
  globalThis[key] = dom.window[key];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const query = await import("@tanstack/react-query");
const h = React.createElement;
const places = [
  { id: "lugbe", name: "Lugbe", secondary: "Abuja", point: { lat: 8.98, lng: 7.37 }, source: "search" },
  { id: "utako", name: "Utako", secondary: "Abuja", point: { lat: 9.06, lng: 7.45 }, source: "search" },
];
const Input = React.forwardRef(function TestInput({ label, hint, icon, inputSize, wrapperClassName, variant, suffix, ...props }, ref) {
  return h("label", null, label, h("input", { ...props, ref }), hint && h("small", null, hint), suffix);
});
function Button({ children, loading, loadingLabel, pill, block, size, variant, icon, iconRight, ...props }) {
  return h("button", { type: "button", ...props, disabled: props.disabled || loading }, loading ? loadingLabel : children);
}
const ui = {
  "@/components/ui/input": { Input, Select: ({ label, options, ...props }) => h("label", null, label, h("select", props, options.map((o) => h("option", { key: o.value, value: o.value }, o.label)))) },
  "@/components/ui/button": { Button, ButtonLink: ({ children, href }) => h("a", { href }, children) },
  "@/components/ui/card": { Card: ({ children }) => h("section", null, children), CardHeader: ({ title, description }) => h("header", null, h("h2", null, title), h("p", null, description)) },
};
const preview = {
  MetricRow: () => null,
  RouteStops: ({ pickup, destination }) => h("p", null, `${pickup.name} → ${destination.name}`),
};
const provider = {
  searchPlaces: async () => places,
  reverseGeocode: async () => places[0],
  calculateRoute: async () => ({ source: "road", points: places.map((p) => p.point), distanceMeters: 10000, durationSeconds: 1200 }),
};
function loadComponent(name, dependencies) {
  const file = new URL(`../src/features/paid-rides/scheduling/${name}.tsx`, import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = new Module(file.pathname);
  const baseRequire = Module.createRequire(file);
  module.require = (path) => path in dependencies ? dependencies[path] : baseRequire(path);
  module._compile(compiled, file.pathname);
  return module.exports;
}
const shared = {
  ...ui,
  "@tanstack/react-query": query,
  "@/hooks/use-debounced-value": { useDebouncedValue },
  "../config": { PAID_RIDES_MODE: "api", PAID_RIDES_CONFIG: { defaultCenter: places[0].point, defaultZoom: 13, searchDebounceMs: 5, searchMinChars: 2 } },
  "../domain/format": format,
  "../components/ride-ui": preview,
  "./booking-card": { scheduleError: (error) => error.message, scheduleDate: (at) => at, BookingCard: () => null, SCHEDULE_LABEL: {} },
};
const { ScheduledRoutePicker } = loadComponent("scheduled-route-picker", {
  ...shared,
  "../services": { getMapProvider: () => provider },
  "../components/ride-map": { RideMap: ({ onReady }) => { React.useEffect(() => { onReady(); }, []); return h("div", null, "Map"); } },
});
let cleanup = async () => {};
afterEach(async () => { await cleanup(); document.body.replaceChildren(); });
async function mount(element) {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host), client = new query.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => root.render(h(query.QueryClientProvider, { client }, element)));
  cleanup = async () => { await act(async () => root.unmount()); client.clear(); host.remove(); };
  return host;
}
async function click(element) { assert.ok(element, "Expected a clickable element"); await act(async () => element.click()); }
const button = (host, text) => [...host.querySelectorAll("button")].find((item) => item.textContent === text);
async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); }); }
async function type(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle(); await settle();
}

test("suggestions survive null-target blur until a single option tap selects the passenger's location", async () => {
  const chosen = [];
  function Harness() {
    const [pickup, setPickup] = React.useState(null), [destination, setDestination] = React.useState(null);
    return h(ScheduledRoutePicker, { pickup, destination, disabled: false, onPendingChange() {}, onChange(field, place) { chosen.push({ field, place }); if (field === "pickup") setPickup(place); else setDestination(place); } });
  }
  const host = await mount(h(Harness));
  const pickup = host.querySelector('input[role="combobox"]');
  await act(async () => pickup.focus());
  await type(pickup, "Lug");
  chosen.length = 0; // Typing clears the unconfirmed location first.
  assert.ok(host.querySelector('[role="listbox"]'));
  assert.ok(host.querySelector('[role="option"]'), "Typed search should load actual provider results");
  await act(async () => pickup.blur()); // iOS can provide no relatedTarget here.
  assert.ok(host.querySelector('[role="listbox"]'), "Blur must not unmount the tapped option");
  await click(host.querySelector('[role="option"]'));
  assert.equal(chosen[0].field, "pickup");
  assert.equal(pickup.value, "Lugbe");
  assert.equal(host.querySelector('[role="listbox"]'), null);
});

test("repeated input taps stay open, outside taps dismiss, and a focused input can reopen", async () => {
  const host = await mount(h(ScheduledRoutePicker, { pickup: null, destination: null, disabled: false, suggestions: places, onPendingChange() {}, onChange() {} }));
  const input = host.querySelector('input[role="combobox"]');
  await act(async () => input.focus());
  await click(input); await click(input);
  assert.ok(host.querySelector('[role="listbox"]'));
  await click(button(host, "Close suggestions"));
  await click(input);
  assert.ok(host.querySelector('[role="listbox"]'));
  await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  assert.equal(host.querySelector('[role="listbox"]'), null);
  assert.ok(input.classList.contains("text-base"), "Use 16px text to avoid iPhone input zoom");
});

test("moving focus between pickup and destination leaves only the active suggestions open", async () => {
  const chosen = [];
  const host = await mount(h(ScheduledRoutePicker, { pickup: null, destination: null, disabled: false, suggestions: places, onPendingChange() {}, onChange: (field, place) => chosen.push({ field, place }) }));
  const [pickup, destination] = host.querySelectorAll('input[role="combobox"]');
  await act(async () => pickup.focus());
  await act(async () => destination.focus());
  assert.equal(host.querySelectorAll('[role="listbox"]').length, 1);
  assert.equal(host.querySelector('[role="listbox"]').getAttribute("aria-label"), "Destination locations");
  await click(host.querySelectorAll('[role="option"]')[1]);
  assert.deepEqual(chosen, [{ field: "destination", place: places[1] }]);
});

test("map preview stays out of the initial form and opens when explicitly requested", async () => {
  const host = await mount(h(ScheduledRoutePicker, { pickup: places[0], destination: places[1], disabled: false, onPendingChange() {}, onChange() {} }));
  assert.equal(host.querySelector('[aria-label="Scheduled trip route preview"]'), null);
  await click(button(host, "Preview route"));
  assert.ok(host.querySelector('[aria-label="Scheduled trip route preview"]'));
  await settle();
  await click(button(host, "Close route preview"));
  assert.equal(host.querySelector('[aria-label="Scheduled trip route preview"]'), null);
});

test("choosing pickup on the map waits for readiness and confirms the selected place", async () => {
  const selected = [], pending = [];
  const host = await mount(h(ScheduledRoutePicker, { pickup: null, destination: null, disabled: false, onPendingChange: (value) => pending.push(value), onChange: (field, place) => selected.push({ field, place }) }));
  await act(async () => host.querySelector('input[role="combobox"]').focus());
  await click(button(host, "Choose on map"));
  assert.ok(host.querySelector('[aria-label="Choose pickup on map"]'));
  assert.equal(pending.at(-1), true);
  await click(button(host, "Confirm pickup"));
  assert.deepEqual(selected, [{ field: "pickup", place: places[0] }]);
  assert.equal(pending.at(-1), false);
  assert.equal(host.querySelector('[aria-label="Choose pickup on map"]'), null);
});

function bookingForm(service) {
  return loadComponent("api-schedule-screen", {
    ...shared,
    "../services": { getRideService: () => service },
    "./api-service": { apiScheduleService: service },
    "./schedule-service": scheduleService,
    "./contract": contract,
    "./passenger-schedules": passengerSchedules,
    "./scheduled-route-picker": { ScheduledRoutePicker: ({ onChange }) => h("div", null, h("button", { onClick: () => onChange("pickup", places[0]) }, "Set pickup"), h("button", { onClick: () => onChange("destination", places[1]) }, "Set destination")) },
    "../realtime": { getRealtimeClient() {} },
    "../hooks/use-ride-viewer": { useRideViewer() {} },
    "@/components/ui/segmented-control": { SegmentedControl: () => null },
    "@/components/ui/states": { EmptyState: () => null, ErrorState: () => null },
    "@/components/ui/route-loader": { RouteLoader: () => null },
  }).ApiBookingForm;
}
function estimate(amount = 500000) {
  return { estimateId: crypto.randomUUID(), options: [{ id: "go", name: "K-Go", shared: false, fare: { total: { amountMinor: amount, currency: "NGN" } } }] };
}
async function prepareForm(service, onCreated = () => {}) {
  const Form = bookingForm(service), host = await mount(h(Form, { now: Date.now(), onCreated }));
  await click(button(host, "Set pickup")); await click(button(host, "Set destination"));
  await click(button(host, "Continue to fare"));
  return host;
}

test("booking progresses from trip details to a compact fare review and clears after success", async () => {
  const requests = []; let created = 0;
  const host = await prepareForm({ estimateRide: async () => estimate(), create: async (body) => { requests.push(body); } }, () => created++);
  assert.match(host.textContent, /Review your trip/);
  assert.equal(host.querySelector('input[type="datetime-local"]'), null);
  assert.equal(host.querySelector("select"), null, "A single ride option needs no selector");
  assert.match(host.textContent, /Lugbe → Utako/);
  await click(button(host, "Confirm scheduled trip"));
  assert.equal(requests.length, 1); assert.equal(created, 1);
  assert.deepEqual(Object.keys(requests[0]).sort(), ["estimateId", "optionId", "scheduledAt", "timezone"]);
  assert.ok(host.querySelector('input[type="datetime-local"]'));
  assert.equal(button(host, "Continue to fare").disabled, true);
});

test("a changed fare requires another review before any booking is submitted", async () => {
  let quotes = 0, writes = 0;
  const host = await prepareForm({ estimateRide: async () => estimate(++quotes === 1 ? 500000 : 600000), create: async () => { writes++; } });
  await click(button(host, "Confirm scheduled trip"));
  assert.equal(writes, 0);
  assert.match(host.textContent, /fare or option changed/);
  await click(button(host, "Confirm scheduled trip"));
  assert.equal(writes, 1);
});

test("an uncertain booking keeps the exact payload for retry and locks editing", async () => {
  const requests = [];
  const host = await prepareForm({ estimateRide: async () => estimate(), create: async (body) => { requests.push(body); if (requests.length === 1) throw new scheduleService.ScheduleApiError("Connection lost", null); } });
  await click(button(host, "Confirm scheduled trip"));
  assert.equal(button(host, "Change trip details").disabled, true);
  await click(button(host, "Retry same booking"));
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
});
