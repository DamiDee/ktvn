import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { compressPdf } from "../src/lib/pdf-compression.ts";
import { encodeDocumentFile, MAX_DOCUMENT_BYTES } from "../src/lib/document-file.ts";

function canvasBrowser(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => createCanvas(1, 1) } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "document", previous); else delete globalThis.document; });
}

async function samplePdf(pages = 2, padding = 0) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([595, 842]);
    page.drawRectangle({ x: 30, y: 730, width: 535, height: 50, color: i % 2 ? rgb(0.8, 0.2, 0.1) : rgb(0.1, 0.5, 0.2) });
    page.drawText(`SYNTHETIC DOCUMENT PAGE ${i + 1}`, { x: 40, y: 680, size: 20, font });
  }
  if (padding) {
    // Extra PDF metadata simulates a bloated file without inventing personal data.
    const context = pdf.context;
    context.register(context.stream(new Uint8Array(padding).fill(42)));
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}

test("a large PDF is automatically prepared on selection and all pages remain in order", async (t) => {
  canvasBrowser(t);
  const source = await samplePdf(3, MAX_DOCUMENT_BYTES + 50_000);
  assert.ok(source.size > MAX_DOCUMENT_BYTES);
  const progress = [];
  const encoded = await encodeDocumentFile(new File([source], "certificate.pdf", { type: "application/pdf" }), (event) => progress.push(event));
  assert.ok(encoded.sizeBytes <= MAX_DOCUMENT_BYTES);
  assert.equal(encoded.originalSizeBytes, source.size);
  assert.equal(encoded.mimeType, "application/pdf");
  const prepared = await PDFDocument.load(Buffer.from(encoded.base64, "base64"));
  assert.equal(prepared.getPageCount(), 3);
  assert.deepEqual(prepared.getPages().map((page) => page.getSize()), Array(3).fill({ width: 595, height: 842 }));
  assert.deepEqual([...new Set(progress.filter((event) => event.page).map((event) => event.page))], [1, 2, 3]);
});

test("PDF fitting never drops pages to meet an impossible byte budget", async (t) => {
  canvasBrowser(t);
  await assert.rejects(compressPdf(await samplePdf(), 100), /keeping every page readable/);
});

test("too many pages and interrupted preparation stop with a useful error", async (t) => {
  canvasBrowser(t);
  await assert.rejects(compressPdf(await samplePdf(21), 200_000), /too many pages/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(compressPdf(await samplePdf(), 200_000, { signal: controller.signal }), (error) => error.name === "AbortError");
});
