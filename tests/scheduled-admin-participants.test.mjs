import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { contactPhoneHref } from "../src/features/admin/accounts/account-directory.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
for (const key of ["window", "document", "HTMLElement", "Node"]) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const query = await import("@tanstack/react-query");
const h = React.createElement;
const calls = [];
let failDriver = false;
const file = new URL("../src/features/paid-rides/scheduling/admin-booking-participants.tsx", import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = new Module(file.pathname);
const deps = {
  "@tanstack/react-query": query,
  "@/features/admin/data/admin-data": { adminData: {
    getDriver: async (id) => { calls.push(["driver", id]); if (failDriver) throw new Error("Unavailable"); return { id, fullName: "Test Driver", phone: "+2348000000000", vehicle: { make: "Toyota", model: "Corolla", plateNumber: "ABJ123", colour: "Blue" } }; },
    getPassenger: async (id) => { calls.push(["passenger", id]); return { id, fullName: "Test Passenger", phone: "+2348111111111" }; },
  } },
  "@/features/admin/accounts/account-directory": { contactPhoneHref },
  "@/components/ui/button": { Button: ({ children, onClick }) => h("button", { onClick }, children), ButtonLink: ({ children, href }) => h("a", { href }, children) },
};
const baseRequire = Module.createRequire(file);
mod.require = (name) => name in deps ? deps[name] : baseRequire(name);
mod._compile(compiled, file.pathname);
const Participants = mod.exports.default;
const booking = { id: "booking", passengerId: "passenger", driverId: "driver", rideId: "ride" };

async function render(input = booking) {
  const client = new query.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(h(query.QueryClientProvider, { client }, h(Participants, { booking: input, viewerId: "admin" }))); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  return { host, close: async () => { await act(async () => root.unmount()); client.clear(); host.remove(); } };
}

test("admin resolves participants and labels current vehicle without claiming a booking assignment", async () => {
  calls.length = 0;
  const view = await render();
  try {
    assert.match(view.host.textContent, /Test Passenger/);
    assert.match(view.host.textContent, /Test Driver/);
    assert.match(view.host.textContent, /Toyota · Corolla · Blue · ABJ123/);
    assert.match(view.host.textContent, /vehicle reserved for this scheduled trip has not been supplied/);
    assert.equal(view.host.querySelector('a[href="tel:+2348000000000"]').textContent, "+2348000000000");
    assert.ok(view.host.querySelector('a[href="/admin/live-rides/ride"]'));
    assert.deepEqual(calls.sort(), [["driver", "driver"], ["passenger", "passenger"]]);
  } finally { await view.close(); }
});

test("a failed driver profile preserves passenger details and exposes retry", async () => {
  failDriver = true;
  const view = await render();
  try {
    assert.match(view.host.textContent, /Test Passenger/);
    assert.match(view.host.textContent, /Some contact details could not load/);
    failDriver = false;
    await act(async () => view.host.querySelector("button").click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.match(view.host.textContent, /Test Driver/);
  } finally { failDriver = false; await view.close(); }
});

test("unassigned bookings do not request a driver or show a vehicle/ride link", async () => {
  calls.length = 0;
  const view = await render({ ...booking, driverId: null, rideId: null });
  try {
    assert.match(view.host.textContent, /Not assigned/);
    assert.equal(calls.some(([kind]) => kind === "driver"), false);
    assert.equal(view.host.querySelector('a[href^="/admin/live-rides/"]'), null);
    assert.doesNotMatch(view.host.textContent, /Driver’s current vehicle/);
  } finally { await view.close(); }
});
