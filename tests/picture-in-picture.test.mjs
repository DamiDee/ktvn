import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";

// Exercise the hook's asynchronous resource ownership with browser adapters.
function setup(t, { play = () => Promise.resolve(), enter = () => Promise.resolve(), documentSupported = false, preferVideo = false } = {}) {
  const effects = [];
  const resources = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    body: { appendChild() {} },
    pictureInPictureElement: null,
    createElement(tag) {
      if (tag === "canvas") return { getContext: () => ({}), captureStream: () => ({ getTracks: () => [{ stop: () => { resources.at(-1).stopped = true; } }] }) };
      const element = new EventTarget();
      Object.assign(element, { style: {}, play, requestPictureInPicture: enter, pause() {}, remove() { element.removed = true; } });
      resources.push(element);
      return element;
    },
  } });
  t.after(() => {
    effects.forEach((cleanup) => cleanup?.());
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else delete globalThis.document;
  });
  const file = new URL("../src/features/paid-rides/pip/use-picture-in-picture.tsx", import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const dependencies = {
    react: { useRef: (current) => ({ current }), useState: (value) => [value, () => {}], useCallback: (callback) => callback, useEffect: (effect) => effects.push(effect()) },
    "react-dom": { createPortal() {} },
    "../analytics": { trackRideEvent() {} },
    "../capabilities": { supportsDocumentPiP: () => documentSupported, supportsVideoPiP: () => true, supportsCanvasCapture: () => true },
    "./trip-canvas": { drawTrackerFrame() {} },
  };
  const loaded = new Module(file.pathname);
  loaded.require = (name) => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; };
  loaded._compile(compiled, file.pathname);
  return { controls: loaded.exports.usePictureInPicture({}, preferVideo), resources };
}

test("driver preference selects canvas video even when document PiP exists", async (t) => {
  const { controls, resources } = setup(t, { documentSupported: true, preferVideo: true });
  assert.equal(controls.strategy, "video");
  assert.equal(await controls.enable(), true);
  assert.equal(resources.length, 1);
  controls.close();
});

test("denied video PiP stops the captured stream and removes the video", async (t) => {
  const { controls, resources } = setup(t, { enter: () => Promise.reject(new Error("Denied")) });
  assert.equal(await controls.enable(), false);
  assert.equal(resources[0].stopped, true);
  assert.equal(resources[0].removed, true);
  assert.equal(resources[0].srcObject, null);
});

test("closing while video playback is pending prevents a late PiP window", async (t) => {
  let resolve;
  let entered = false;
  const { controls, resources } = setup(t, { play: () => new Promise((done) => { resolve = done; }), enter: async () => { entered = true; } });
  const pending = controls.enable();
  assert.equal(await controls.enable(), false);
  controls.close();
  resolve();
  assert.equal(await pending, false);
  assert.equal(entered, false);
  assert.equal(resources[0].stopped, true);
});

test("user closing PiP releases its stream and rendering timer", async (t) => {
  const { controls, resources } = setup(t);
  assert.equal(await controls.enable(), true);
  resources[0].dispatchEvent(new Event("leavepictureinpicture"));
  assert.equal(resources[0].stopped, true);
  assert.equal(resources[0].removed, true);
});
