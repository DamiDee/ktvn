export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};

/** Read the actual bytes; never send filenames, blob URLs or data-URL prefixes. */
export async function encodeDocumentFile(file: File): Promise<{ base64: string; mimeType: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_TYPES[extension];
  if (!mimeType || (file.type && file.type !== mimeType)) throw new Error("Choose a PDF, JPG or PNG file.");
  if (!file.size) throw new Error("That file is empty. Choose another file.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("The file limit is 8 MB. Choose a smaller file.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  // Limit each call's argument count for large documents on mobile browsers.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return { base64: btoa(chunks.join("")), mimeType };
}
