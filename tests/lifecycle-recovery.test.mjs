import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";

test("mobile resume events reconnect once, recover again after offline, and clean up", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const page = new EventTarget(), host = new EventTarget();
  page.visibilityState = "visible";
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "document", { configurable: true, value: page });
  Object.defineProperty(globalThis, "window", { configurable: true, value: host });
  const cleanups = [];
  t.after(() => {
    cleanups.forEach((cleanup) => cleanup?.());
    for (const [name, descriptor] of [["document", oldDocument], ["window", oldWindow]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const file = new URL("../src/features/paid-rides/hooks/use-lifecycle-recovery.ts", import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = new Module(file.pathname);
  loaded.require = (name) => {
    assert.equal(name, "react");
    return { useRef: (current) => ({ current }), useEffect: (effect) => cleanups.push(effect()) };
  };
  loaded._compile(compiled, file.pathname);
  let resumes = 0, offline = 0;
  loaded.exports.useLifecycleRecovery({ onResume: () => resumes++, onOffline: () => offline++ });
  page.visibilityState = "hidden"; page.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(60_000);
  page.visibilityState = "visible"; page.dispatchEvent(new Event("visibilitychange"));
  host.dispatchEvent(new Event("focus"));
  const shown = new Event("pageshow"); shown.persisted = true; host.dispatchEvent(shown);
  assert.equal(resumes, 1);
  host.dispatchEvent(new Event("offline")); host.dispatchEvent(new Event("online"));
  assert.equal(offline, 1); assert.equal(resumes, 2);
  cleanups.forEach((cleanup) => cleanup?.());
  t.mock.timers.tick(2_000); host.dispatchEvent(new Event("focus"));
  assert.equal(resumes, 2);
});
