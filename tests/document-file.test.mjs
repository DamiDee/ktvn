import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  encodeDocumentFile, getApplicationSizeError,
  IMAGE_TARGET_BYTES, MAX_APPLICATION_BYTES, MAX_DOCUMENT_BYTES, MAX_SOURCE_IMAGE_BYTES,
} from "../src/lib/document-file.ts";

function photo(size = IMAGE_TARGET_BYTES + 1) {
  return new File([new Uint8Array(size)], "camera.png", { type: "image/png" });
}

function mockGlobal(t, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else delete globalThis[key];
  });
}

function imageBrowser(t, encode, width = 4000, height = 3000) {
  const draws = [];
  const attempts = [];
  let closed = false;
  let whiteBackground = false;
  const bitmap = { width, height, close() { closed = true; } };
  const context = {
    fillStyle: "", imageSmoothingQuality: "",
    fillRect() { whiteBackground = this.fillStyle === "#ffffff"; },
    drawImage(_image, _x, _y, width, height) { draws.push({ width, height }); },
  };
  const canvas = {
    width: 0, height: 0,
    getContext() { return context; },
    toBlob(callback, type, quality) {
      attempts.push({ width: this.width, height: this.height, type, quality });
      callback(encode(attempts.at(-1)));
    },
  };
  mockGlobal(t, "document", { createElement: () => canvas });
  mockGlobal(t, "createImageBitmap", async (_file, options) => {
    assert.equal(options.imageOrientation, "from-image");
    return bitmap;
  });
  return { draws, attempts, canvas, closed: () => closed, white: () => whiteBackground };
}

test("large camera photos are resized, compressed and sent as raw JPEG Base64", async (t) => {
  const bytes = new Uint8Array(IMAGE_TARGET_BYTES - 10).fill(127);
  const browser = imageBrowser(t, ({ width, quality }) => new Blob(
    [width > 1600 || quality > 0.75 ? new Uint8Array(IMAGE_TARGET_BYTES + 1) : bytes],
    { type: "image/jpeg" },
  ));
  const original = photo(3 * 1024 * 1024);
  const encoded = await encodeDocumentFile(original);
  assert.equal(encoded.mimeType, "image/jpeg");
  assert.equal(encoded.originalSizeBytes, original.size);
  assert.equal(encoded.sizeBytes, bytes.length);
  assert.deepEqual(Buffer.from(encoded.base64, "base64"), Buffer.from(bytes));
  assert.ok(browser.draws.length > 1, "lower resolution is tried when quality alone is insufficient");
  for (const { width, height } of browser.draws) assert.equal(width / height, 4 / 3);
  assert.ok(browser.attempts.every(({ quality }) => quality > 0 && quality <= 1));
  assert.equal(browser.white(), true);
  assert.equal(browser.closed(), true);
  assert.equal(browser.canvas.width, 0);
});

test("compression does not enlarge small-dimension images", async (t) => {
  const browser = imageBrowser(t, () => new Blob(["jpeg bytes"], { type: "image/jpeg" }), 300, 200);
  await encodeDocumentFile(photo());
  assert.deepEqual(browser.draws, [{ width: 300, height: 200 }]);
});

test("already-small photos preserve their original bytes", async (t) => {
  mockGlobal(t, "createImageBitmap", () => { throw new Error("should not decode"); });
  const original = new File([new Uint8Array(100)], "small.jpg", { type: "image/jpeg" });
  const encoded = await encodeDocumentFile(original);
  assert.equal(encoded.mimeType, "image/jpeg");
  assert.equal(encoded.sizeBytes, original.size);
  assert.equal(encoded.originalSizeBytes, original.size);
  assert.deepEqual(Buffer.from(encoded.base64, "base64"), Buffer.from(new Uint8Array(100)));
});

test("unreadable and oversized original photos are refused before encoding", async (t) => {
  let decodes = 0;
  mockGlobal(t, "document", {});
  mockGlobal(t, "createImageBitmap", async () => { decodes++; throw new Error("decode failed"); });
  await assert.rejects(encodeDocumentFile(photo(MAX_SOURCE_IMAGE_BYTES + 1)), /Photos can be up to/);
  assert.equal(decodes, 0);
  await assert.rejects(encodeDocumentFile(photo()), /couldn't read that photo/);
});

test("encoding failures free image resources and never send a mislabeled file", async (t) => {
  for (const result of [null, new Blob([], { type: "image/jpeg" }), new Blob(["png"], { type: "image/png" })]) {
    const browser = imageBrowser(t, () => result);
    await assert.rejects(encodeDocumentFile(photo()), /couldn't prepare that photo/);
    assert.equal(browser.closed(), true);
    assert.equal(browser.canvas.width, 0);
  }
});

test("photos that cannot meet the budget are refused with a helpful message", async (t) => {
  const browser = imageBrowser(t, () => new Blob([new Uint8Array(IMAGE_TARGET_BYTES + 1)], { type: "image/jpeg" }));
  await assert.rejects(encodeDocumentFile(photo()), /closer, well-lit photo/);
  assert.equal(browser.closed(), true);
});

test("the complete JSON budget counts UTF-8 bytes and accepts the exact boundary", () => {
  assert.equal(getApplicationSizeError("a".repeat(MAX_APPLICATION_BYTES)), null);
  assert.match(getApplicationSizeError("a".repeat(MAX_APPLICATION_BYTES) + "a"), /limit/);
  assert.match(getApplicationSizeError("é".repeat(Math.floor(MAX_APPLICATION_BYTES / 2) + 1)), /limit/);
  const eightFiles = JSON.stringify({ documents: Array(8).fill(Buffer.alloc(IMAGE_TARGET_BYTES).toString("base64")), fields: "x".repeat(4096) });
  assert.equal(getApplicationSizeError(eightFiles), null);
});

test("configured limits adjust compression, while invalid limits use the safe default", () => {
  const moduleUrl = new URL("../src/lib/document-file.ts", import.meta.url).href;
  for (const value of ["1048576", "-1", "Infinity", "bad", "0", "1.5"]) {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e",
      `const m = await import(${JSON.stringify(moduleUrl)}); process.stdout.write(JSON.stringify([m.MAX_APPLICATION_BYTES, m.IMAGE_TARGET_BYTES, m.MAX_DOCUMENT_BYTES]));`],
      { env: { ...process.env, NEXT_PUBLIC_MAX_APPLICATION_BYTES: value }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const [budget, target, pdfLimit] = JSON.parse(result.stdout);
    assert.equal(budget, value === "1048576" ? 1048576 : 2 * 1024 * 1024);
    assert.ok(8 * Math.ceil(target / 3) * 4 + 4096 < budget);
    assert.ok(pdfLimit <= MAX_DOCUMENT_BYTES);
  }
});
