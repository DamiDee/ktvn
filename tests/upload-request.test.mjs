import assert from "node:assert/strict";
import test from "node:test";
import { uploadJson, UploadRequestError } from "../src/lib/upload-request.ts";
import { liveAuth, FreebusError } from "../src/services/freebus-api.ts";
import { accountSession } from "../src/lib/account-session.ts";

function browser(t) {
  const instances = [];
  class FakeXHR {
    upload = new EventTarget();
    headers = {};
    status = 0;
    responseText = "";
    constructor() { instances.push(this); }
    open(method, url, async) { Object.assign(this, { method, url, async }); }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(body) { this.body = body; }
    abort() { this.aborted = true; this.onabort?.(); }
    progress(loaded) { this.upload.dispatchEvent(Object.assign(new Event("progress"), { loaded })); }
    uploaded() { this.upload.dispatchEvent(new Event("load")); }
    respond(status, text) { this.status = status; this.responseText = text; this.onload?.(); }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, writable: true, value: FakeXHR });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "XMLHttpRequest", previous);
    else delete globalThis.XMLHttpRequest;
  });
  return instances;
}

test("live byte updates are monotonic and upload completion still waits for a server response", async (t) => {
  const requests = browser(t);
  const updates = [];
  const body = JSON.stringify({ file: "a".repeat(100_000), name: "é" });
  let finished = false;
  const result = uploadJson("https://api.example.test/users", body, { onProgress: (event) => updates.push(event) }).then((response) => { finished = true; return response; });
  const request = requests[0];
  assert.equal(request.withCredentials, true);
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.equal(request.body, body);
  request.progress(32_768);
  request.progress(65_536);
  request.progress(60_000); // A stale update must not move backwards.
  assert.equal(updates.at(-1).loadedBytes, 65_536);
  assert.equal(updates[2].deltaBytes, 32_768);
  request.uploaded();
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(updates.at(-1).phase, "confirming");
  assert.equal(updates.at(-1).loadedBytes, new TextEncoder().encode(body).length);
  request.respond(201, '{"id":"driver-id"}');
  assert.equal((await result).status, 201);
  const count = updates.length;
  request.progress(999_999);
  assert.equal(updates.length, count);
});

test("a readable HTML 413 reaches the registration UI without a retry", async (t) => {
  const requests = browser(t);
  const result = liveAuth.register({ username: "testdriver", driver_details: { profile_photo: "YWJj" } }, { onProgress() {} });
  requests[0].progress(10);
  requests[0].respond(413, "<html>Request Entity Too Large</html>");
  await assert.rejects(result, (error) => error instanceof FreebusError && error.status === 413);
  assert.equal(requests.length, 1);
});

test("registration confirms an enveloped API response only after the upload has finished", async (t) => {
  const requests = browser(t);
  const updates = [];
  const result = liveAuth.register({ username: "testdriver" }, { onProgress: (event) => updates.push(event) });
  requests[0].uploaded();
  requests[0].respond(200, '{"message":"Created","data":{"id":"test-driver","role":"Driver"}}');
  assert.equal((await result).id, "test-driver");
  assert.equal(updates.at(-1).phase, "confirming");
  assert.equal(requests.length, 1);
});

test("timeout and network errors do not retry account creation or claim a 413", async (t) => {
  const requests = browser(t);
  for (const reason of ["timeout", "network"]) {
    const result = uploadJson("https://api.example.test/users", "{}", { onProgress() {} });
    const request = requests.at(-1);
    if (reason === "timeout") request.ontimeout();
    else request.onerror();
    await assert.rejects(result, (error) => error instanceof UploadRequestError && error.reason === reason);
  }
  assert.equal(requests.length, 2);
});

test("abort cleans up callbacks and an already-aborted upload never opens a request", async (t) => {
  const requests = browser(t);
  const controller = new AbortController();
  const updates = [];
  const result = uploadJson("https://api.example.test/users", "{}", { signal: controller.signal, onProgress: (event) => updates.push(event) });
  controller.abort();
  await assert.rejects(result, (error) => error.reason === "aborted");
  const count = updates.length;
  requests[0].progress(2);
  assert.equal(updates.length, count);
  assert.equal(requests[0].aborted, true);
  await assert.rejects(uploadJson("https://api.example.test/users", "{}", { signal: controller.signal, onProgress() {} }), (error) => error.reason === "aborted");
  assert.equal(requests.length, 1);
});

test("changing accounts aborts registration and prevents late upload callbacks", async (t) => {
  const requests = browser(t);
  const wasBlocked = accountSession.isBlocked();
  t.after(() => accountSession.replace(wasBlocked));
  const updates = [];
  const result = liveAuth.register({ username: "testdriver" }, { onProgress: (event) => updates.push(event) });
  accountSession.replace(true);
  await assert.rejects(result, (error) => error instanceof FreebusError);
  const count = updates.length;
  requests[0].progress(100);
  assert.equal(updates.length, count);
  assert.equal(requests[0].aborted, true);
});
