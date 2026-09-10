/**
 * Transport boundary.
 *
 * Every repository goes through `request`. Today it resolves from the mock
 * fixtures with a simulated delay; when the backend exists, only this file
 * changes — swap the body of `request` for a fetch and delete `MockDelay`.
 */

export interface RequestOptions {
  /** Simulated round-trip in ms. Overridden per call where useful. */
  delayMs?: number;
  /** Probability (0–1) that the call rejects, for exercising error states. */
  failureRate?: number;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code = "UNKNOWN", retryable = true) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

export const MockDelay = {
  instant: 120,
  fast: 320,
  normal: 620,
  slow: 1100,
  matching: 2400,
} as const;

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError("Request cancelled", "ABORTED", false));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError("Request cancelled", "ABORTED", false));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Deep clone so callers can never mutate a shared fixture by accident. */
function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  return structuredClone(value);
}

export async function request<T>(
  resolver: () => T | Promise<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { delayMs = MockDelay.normal, failureRate = 0, signal } = options;

  await sleep(delayMs, signal);

  if (failureRate > 0 && Math.random() < failureRate) {
    throw new ApiError(
      "We couldn't reach the network just now.",
      "NETWORK",
      true,
    );
  }

  return clone(await resolver());
}

/** Stable id generator for optimistic records created in the browser. */
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
