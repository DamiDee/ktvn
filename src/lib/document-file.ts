/**
 * Document files for the driver application.
 *
 * Every document travels as Base64 inside a single JSON `POST /users`, so the
 * request grows with each file (Base64 adds a third on top). Phone photos are
 * routinely 3–12 MB, which pushed the request past the API's body limit and
 * produced `413 Request Entity Too Large`. To keep the request small:
 *
 * - Photos (JPG/PNG) are resized and re-encoded as JPEG in the browser until
 *   they fit `IMAGE_TARGET_BYTES`. Already-small photos are sent untouched.
 * - Large PDFs are rebuilt from rendered pages, preserving every page.
 * - A final pass reduces the complete request before it is sent.
 */

/**
 * App-side budget, not a claim about the API's limit. Configure this below the
 * smallest API/proxy body limit and rebuild the app when changing it.
 */
const configuredBudget = Number(process.env.NEXT_PUBLIC_MAX_APPLICATION_BYTES);
export const MAX_APPLICATION_BYTES =
  Number.isSafeInteger(configuredBudget) && configuredBudget > 0 ? configuredBudget : 2 * 1024 * 1024;
/** Leave headroom below the hard request limit, including decimal 2 MB proxies. */
export const APPLICATION_TARGET_BYTES = Math.floor(MAX_APPLICATION_BYTES * 0.9);
// Reserve room for the DTO fields; a non-worker application has eight files.
const documentBudget = Math.max(1, MAX_APPLICATION_BYTES - 64 * 1024);
/** Largest PDF, allowing for Base64 expansion inside the JSON request. */
export const MAX_DOCUMENT_BYTES = Math.min(1024 * 1024, Math.floor(documentBudget * 3 / 4));
/** Largest original photo we accept — it is compressed before it's stored. */
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_SOURCE_PDF_BYTES = 10 * 1024 * 1024;
/** Eight photos plus Base64 overhead must fit the complete request budget. */
export const IMAGE_TARGET_BYTES = Math.max(1, Math.min(400 * 1024, Math.floor(documentBudget * 3 / 4 / 8)));

export const ACCEPTED_DOCUMENT_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};

/** Longest edge attempts, largest first — documents must stay legible. */
const IMAGE_EDGES = [2000, 1600, 1280, 1024];
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55];

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return formatMegabytes(bytes);
}

/** Check the UTF-8 JSON body, including Base64 expansion and personal details. */
export function getApplicationSizeError(body: string): string | null {
  const bytes = new TextEncoder().encode(body).length;
  return bytes > MAX_APPLICATION_BYTES
    ? `Your application is ${formatFileSize(bytes)}. The limit is ${formatFileSize(MAX_APPLICATION_BYTES)}. Use smaller PDFs or replace them with photos, then try again.`
    : null;
}

export interface EncodedDocument {
  base64: string;
  mimeType: string;
  /** Size of the bytes actually sent, after any compression. */
  sizeBytes: number;
  originalSizeBytes: number;
}

export interface DocumentPreparationProgress {
  phase: "checking" | "reading" | "resizing" | "compressing" | "encoding";
  processedBytes?: number;
  totalBytes?: number;
  page?: number;
  pages?: number;
}

type PreparationListener = (progress: DocumentPreparationProgress) => void;

/** Read the actual bytes; never send filenames, blob URLs or data-URL prefixes. */
export async function encodeDocumentFile(file: File, onProgress?: PreparationListener): Promise<EncodedDocument> {
  onProgress?.({ phase: "checking" });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_TYPES[extension];
  if (!mimeType || (file.type && file.type !== mimeType)) throw new Error("Choose a PDF, JPG or PNG file.");
  if (!file.size) throw new Error("That file is empty. Choose another file.");

  const isImage = mimeType !== "application/pdf";
  if (!isImage) {
    if (file.size > MAX_SOURCE_PDF_BYTES) throw new Error(`PDFs can be up to ${formatMegabytes(MAX_SOURCE_PDF_BYTES)}.`);
    const prepared = file.size > MAX_DOCUMENT_BYTES
      ? await compressDocumentBlob(new Blob([file], { type: mimeType }), MAX_DOCUMENT_BYTES, { onProgress })
      : file;
    return { base64: await toBase64(prepared, onProgress), mimeType, sizeBytes: prepared.size, originalSizeBytes: file.size };
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(`Photos can be up to ${formatMegabytes(MAX_SOURCE_IMAGE_BYTES)}. Choose a smaller photo.`);
  }
  // Small photos go as they are: no quality loss, no work.
  if (file.size <= IMAGE_TARGET_BYTES) {
    return { base64: await toBase64(file, onProgress), mimeType, sizeBytes: file.size, originalSizeBytes: file.size };
  }

  const compressed = await compressImage(file, IMAGE_TARGET_BYTES, { onProgress });
  return { base64: await toBase64(compressed, onProgress), mimeType: compressed.type, sizeBytes: compressed.size, originalSizeBytes: file.size };
}

export interface DocumentCompressionOptions {
  onProgress?: PreparationListener;
  signal?: AbortSignal;
}

export function checkDocumentAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Preparation interrupted", "AbortError");
}

/** Recompress an existing selection without requiring another file upload. */
export async function compressDocumentContent(base64: string, mimeType: string, targetBytes: number, options: DocumentCompressionOptions = {}): Promise<EncodedDocument> {
  checkDocumentAbort(options.signal);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const original = new Blob([bytes], { type: mimeType });
  const compressed = await compressDocumentBlob(original, targetBytes, options);
  checkDocumentAbort(options.signal);
  return { base64: await toBase64(compressed, options.onProgress), mimeType: compressed.type, sizeBytes: compressed.size, originalSizeBytes: original.size };
}

async function compressDocumentBlob(blob: Blob, targetBytes: number, options: DocumentCompressionOptions): Promise<Blob> {
  if (blob.type === "application/pdf") {
    const { compressPdf } = await import("./pdf-compression.ts");
    return compressPdf(blob, targetBytes, options);
  }
  if (blob.type !== "image/jpeg" && blob.type !== "image/png") throw new Error("This document format cannot be prepared automatically.");
  return compressImage(blob, targetBytes, options);
}

/**
 * Resize and re-encode a photo as JPEG until it fits `IMAGE_TARGET_BYTES`.
 * Orientation from the camera's EXIF data is applied, and transparency (PNG)
 * is flattened onto white so documents stay readable.
 */
async function compressImage(file: Blob, targetBytes: number, { onProgress, signal }: DocumentCompressionOptions): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error(`This browser can't prepare large photos. Choose a photo under ${formatFileSize(IMAGE_TARGET_BYTES)}.`);
  }

  let bitmap: ImageBitmap;
  try {
    onProgress?.({ phase: "reading" });
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("We couldn't read that photo. Try another JPG or PNG.");
  }

  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("We couldn't prepare that photo. Please try again.");

    for (const edge of IMAGE_EDGES) {
      checkDocumentAbort(signal);
      onProgress?.({ phase: "resizing" });
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of JPEG_QUALITIES) {
        checkDocumentAbort(signal);
        onProgress?.({ phase: "compressing" });
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (!blob?.size || blob.type !== "image/jpeg") {
          throw new Error("We couldn't prepare that photo. Please try another JPG or PNG.");
        }
        if (blob.size <= targetBytes) return blob;
      }
    }
    throw new Error("That photo is too detailed to send. Try a closer, well-lit photo of just the document.");
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function toBase64(blob: Blob, onProgress?: PreparationListener): Promise<string> {
  onProgress?.({ phase: "reading" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  // Limit each call's argument count for large documents on mobile browsers.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    onProgress?.({ phase: "encoding", processedBytes: Math.min(offset + 0x8000, bytes.length), totalBytes: bytes.length });
  }
  return btoa(chunks.join(""));
}
