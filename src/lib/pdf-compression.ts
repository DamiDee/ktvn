import { checkDocumentAbort, type DocumentCompressionOptions } from "./document-file.ts";

/** Loaded only when a PDF needs shrinking. No document bytes leave the browser. */
export async function compressPdf(source: Blob, targetBytes: number, { onProgress, signal }: DocumentCompressionOptions = {}): Promise<Blob> {
  const [pdfjs, { PDFDocument }] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdf-lib")]);
  if (typeof window !== "undefined") pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  checkDocumentAbort(signal);
  const task = pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()), stopAtErrors: true, useSystemFonts: true });
  // Encrypted PDFs need an unlocked source; never leave a password prompt hanging.
  task.onPassword = () => { void task.destroy(); };
  const abort = () => { void task.destroy(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await task.promise;
    // Bound CPU/memory on mobile; never omit extra pages to meet a byte target.
    if (!pdf.numPages || pdf.numPages > 20) throw new Error("This PDF has too many pages to prepare on this device. Contact support for help with this document.");
    for (const { edge, quality } of [{ edge: 1800, quality: 0.82 }, { edge: 1500, quality: 0.72 }, { edge: 1280, quality: 0.6 }]) {
      const result = await PDFDocument.create();
      for (let index = 1; index <= pdf.numPages; index++) {
        checkDocumentAbort(signal);
        onProgress?.({ phase: "compressing", page: index, pages: pdf.numPages });
        const page = await pdf.getPage(index);
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2, edge / Math.max(original.width, original.height)) });
        const canvas = document.createElement("canvas");
        try {
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("This device couldn't prepare the PDF. Contact support for help.");
          await page.render({ canvas, canvasContext: context, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS, background: "white" }).promise;
          checkDocumentAbort(signal);
          const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
          if (!jpeg?.size || jpeg.type !== "image/jpeg") throw new Error("This device couldn't prepare the PDF. Contact support for help.");
          const image = await result.embedJpg(await jpeg.arrayBuffer());
          result.addPage([original.width, original.height]).drawImage(image, { x: 0, y: 0, width: original.width, height: original.height });
        } finally {
          canvas.width = canvas.height = 0;
          page.cleanup();
        }
      }
      checkDocumentAbort(signal);
      const bytes = await result.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      if (blob.size <= targetBytes) return blob;
    }
    throw new Error("We couldn't make this PDF small enough while keeping every page readable. Contact support for help with this document.");
  } catch (error) {
    checkDocumentAbort(signal);
    if (error instanceof Error && /Contact support|too many pages|couldn't make/.test(error.message)) throw error;
    throw new Error("We couldn't prepare this PDF. It may be locked or damaged. Contact support for help with this document.");
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy().catch(() => undefined);
  }
}
