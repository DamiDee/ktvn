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
 * - PDFs can't be safely recompressed client-side, so they have a firm cap.
 * - The whole request is checked against `MAX_APPLICATION_BYTES` before it is
 *   sent (see `driver-registration.ts`).
 */

/** Largest document we will store after processing (PDF, or a compressed photo). */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
/** Largest original photo we accept — it is compressed before it's stored. */
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
/** Photos above this are resized/re-encoded until they fit. */
export const IMAGE_TARGET_BYTES = 400 * 1024;
/**
 * Ceiling for the complete registration request body. Must stay below the
 * API's request-body limit; override with NEXT_PUBLIC_MAX_APPLICATION_BYTES
 * once the server's exact limit is confirmed.
 */
export const MAX_APPLICATION_BYTES =
  Number(process.env.NEXT_PUBLIC_MAX_APPLICATION_BYTES) || 5 * 1024 * 1024;

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

export interface EncodedDocument {
  base64: string;
  mimeType: string;
  /** Size of the bytes actually sent, after any compression. */
  sizeBytes: number;
}

/** Read the actual bytes; never send filenames, blob URLs or data-URL prefixes. */
export async function encodeDocumentFile(file: File): Promise<EncodedDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_TYPES[extension];
  if (!mimeType || (file.type && file.type !== mimeType)) throw new Error("Choose a PDF, JPG or PNG file.");
  if (!file.size) throw new Error("That file is empty. Choose another file.");

  const isImage = mimeType !== "application/pdf";
  if (!isImage) {
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error(
        `PDFs can be up to ${formatMegabytes(MAX_DOCUMENT_BYTES)}. Upload a photo of the document instead, or a smaller PDF.`,
      );
    }
    return { base64: await toBase64(file), mimeType, sizeBytes: file.size };
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error(`Photos can be up to ${formatMegabytes(MAX_SOURCE_IMAGE_BYTES)}. Choose a smaller photo.`);
  }
  // Small photos go as they are: no quality loss, no work.
  if (file.size <= IMAGE_TARGET_BYTES) {
    return { base64: await toBase64(file), mimeType, sizeBytes: file.size };
  }

  const compressed = await compressImage(file);
  return { base64: await toBase64(compressed), mimeType: "image/jpeg", sizeBytes: compressed.size };
}

/**
 * Resize and re-encode a photo as JPEG until it fits `IMAGE_TARGET_BYTES`.
 * Orientation from the camera's EXIF data is applied, and transparency (PNG)
 * is flattened onto white so documents stay readable.
 */
async function compressImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("This browser can't prepare large photos. Choose a photo under 400 KB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("We couldn't read that photo. Try another JPG or PNG.");
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("We couldn't prepare that photo. Please try again.");

    for (const edge of IMAGE_EDGES) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of JPEG_QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (blob && blob.size <= IMAGE_TARGET_BYTES) return blob;
      }
    }
    throw new Error("That photo is too detailed to send. Try a closer, well-lit photo of just the document.");
  } finally {
    bitmap.close();
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  // Limit each call's argument count for large documents on mobile browsers.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(chunks.join(""));
}
