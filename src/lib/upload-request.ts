/** Browser-reported transfer progress for a single JSON request, not resumable chunks. */
export interface UploadProgress {
  phase: "uploading" | "confirming";
  loadedBytes: number;
  totalBytes: number;
  deltaBytes: number;
}

export interface UploadRequestOptions {
  onProgress: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

export class UploadRequestError extends Error {
  reason: "network" | "timeout" | "aborted";

  constructor(reason: "network" | "timeout" | "aborted") {
    super(reason === "timeout" ? "The server took too long to confirm your application. Check whether your account was created before submitting again."
      : reason === "aborted" ? "The upload was interrupted. Check whether your account was created before submitting again."
      : "We couldn't confirm your application. Check your connection. If this continues, contact support before submitting again.");
    this.name = "UploadRequestError";
    this.reason = reason;
  }
}

/** XHR exposes upload progress on mobile browsers; fetch does not provide it. */
export function uploadJson(url: string, body: string, { onProgress, signal }: UploadRequestOptions): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new UploadRequestError("aborted")); return; }
    const xhr = new XMLHttpRequest();
    const totalBytes = new TextEncoder().encode(body).length;
    let loadedBytes = 0;
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      xhr.upload.removeEventListener("progress", progress);
      xhr.upload.removeEventListener("load", uploaded);
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
    };
    const fail = (reason: "network" | "timeout" | "aborted") => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new UploadRequestError(reason));
    };
    const abort = () => { xhr.abort(); fail("aborted"); };
    const report = (phase: UploadProgress["phase"], loaded: number) => {
      if (settled || signal?.aborted) return;
      const next = Math.max(loadedBytes, Math.min(totalBytes, loaded));
      const deltaBytes = next - loadedBytes;
      loadedBytes = next;
      onProgress({ phase, loadedBytes, totalBytes, deltaBytes });
    };
    const progress = (event: ProgressEvent) => report("uploading", event.loaded);
    const uploaded = () => report("confirming", totalBytes);
    // Register before open/send for mobile browser compatibility.
    xhr.upload.addEventListener("progress", progress);
    xhr.upload.addEventListener("load", uploaded);
    xhr.onload = () => {
      if (settled) return;
      if (xhr.status < 200 || xhr.status > 599) { fail("network"); return; }
      // Completing transmission is not success: the caller checks status + response DTO.
      settled = true;
      const response = new Response(xhr.responseText || null, { status: xhr.status });
      cleanup();
      resolve(response);
    };
    xhr.onerror = () => fail("network");
    xhr.ontimeout = () => fail("timeout");
    xhr.onabort = () => fail("aborted");
    signal?.addEventListener("abort", abort, { once: true });
    try {
      xhr.open("POST", url, true);
      xhr.withCredentials = true;
      xhr.timeout = 180_000;
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      report("uploading", 0);
      xhr.send(body);
    } catch {
      fail("network");
    }
  });
}
