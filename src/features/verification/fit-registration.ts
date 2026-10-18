import type { CreateUserDto, DriverRegistrationDto } from "../../types/driver-api.ts";
import { APPLICATION_TARGET_BYTES, checkDocumentAbort, type EncodedDocument } from "../../lib/document-file.ts";

export interface ApplicationDocument {
  field: keyof DriverRegistrationDto;
  label: string;
  mimeType: string;
  originalSizeBytes: number;
}

export interface ApplicationOptimizationProgress {
  totalBytes: number;
  originalBytes: number;
  label?: string;
  page?: number;
  pages?: number;
}

type Reducer = (base64: string, mimeType: string, targetBytes: number, label: string) => Promise<EncodedDocument>;
const bodySize = (payload: CreateUserDto) => new TextEncoder().encode(JSON.stringify(payload)).length;
const rawSize = (base64: string) => base64.length / 4 * 3 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);

/** Re-measure the complete DTO after each reduction; never truncate or drop a field. */
export async function fitRegistration(payload: CreateUserDto, documents: ApplicationDocument[], reduce: Reducer, options: {
  signal?: AbortSignal;
  onProgress?: (progress: ApplicationOptimizationProgress) => void;
  targetBytes?: number;
} = {}) {
  const target = options.targetBytes ?? APPLICATION_TARGET_BYTES;
  const result: CreateUserDto = { ...payload, driver_details: { ...payload.driver_details! } };
  const prepared = new Map<keyof DriverRegistrationDto, EncodedDocument>();
  const originalSizes = new Map(documents.map((doc) => [doc.field, rawSize(String(result.driver_details![doc.field] ?? ""))]));
  const originalBytes = bodySize(result);
  let totalBytes = originalBytes;
  options.onProgress?.({ totalBytes, originalBytes });
  for (let round = 0; round < 3 && totalBytes > target; round++) {
    const largestFirst = [...documents].sort((a, b) => String(result.driver_details![b.field]).length - String(result.driver_details![a.field]).length);
    let improved = false;
    for (const doc of largestFirst) {
      checkDocumentAbort(options.signal);
      if (totalBytes <= target) break;
      const content = result.driver_details![doc.field];
      if (typeof content !== "string" || !content) continue;
      const size = rawSize(content);
      // Avoid forcing tiny images below a practical document-quality floor.
      const floor = 48 * 1024;
      if (size <= floor) continue;
      const desired = Math.max(floor, Math.floor(size - Math.min(size * 0.5, (totalBytes - target) * 0.75 + 8192)));
      options.onProgress?.({ totalBytes, originalBytes, label: doc.label });
      let compressed: EncodedDocument;
      try { compressed = await reduce(content, prepared.get(doc.field)?.mimeType ?? doc.mimeType, desired, doc.label); }
      catch {
        checkDocumentAbort(options.signal);
        continue; // Another file may provide the saving without damaging this one.
      }
      checkDocumentAbort(options.signal);
      // Compare actual Base64 content, not caller-supplied file metadata.
      if (!compressed.base64 || compressed.base64.length >= content.length) continue;
      Object.assign(result.driver_details!, { [doc.field]: compressed.base64 });
      prepared.set(doc.field, { ...compressed, originalSizeBytes: doc.originalSizeBytes || originalSizes.get(doc.field)! });
      totalBytes = bodySize(result);
      improved = true;
      options.onProgress?.({ totalBytes, originalBytes, label: doc.label });
    }
    if (!improved) break;
  }
  checkDocumentAbort(options.signal);
  if (totalBytes > target) throw new Error("We couldn't make the application small enough while keeping your documents readable. Your answers and files are safe on this page. Contact support for help completing your application.");
  return { payload: result, prepared, totalBytes, originalBytes };
}
