/**
 * Failure vocabulary. Service implementations translate transport and
 * backend errors into these codes; screens only ever show the plain-language
 * copy below — never a raw server message.
 */

export type RideErrorCode =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "estimate_expired"
  | "no_drivers"
  | "already_taken"
  | "request_expired"
  | "driver_ineligible"
  | "wrong_pin"
  | "payment_failed"
  | "rate_limited"
  | "unavailable"
  | "not_supported"
  | "unknown";

export class RideServiceError extends Error {
  readonly code: RideErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(code: RideErrorCode, options: { status?: number | null; retryable?: boolean; cause?: unknown } = {}) {
    super(code);
    this.name = "RideServiceError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? (code === "network" || code === "timeout" || code === "unavailable" || code === "rate_limited");
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function toRideError(error: unknown): RideServiceError {
  if (error instanceof RideServiceError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new RideServiceError("timeout", { cause: error });
  if (error instanceof TypeError) return new RideServiceError("network", { cause: error });
  return new RideServiceError("unknown", { cause: error });
}

export function errorCodeForStatus(status: number): RideErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 410) return "request_expired";
  if (status === 422 || status === 400) return "validation";
  if (status === 402) return "payment_failed";
  if (status === 429) return "rate_limited";
  if (status === 501) return "not_supported";
  if (status >= 500) return "unavailable";
  return "unknown";
}

export const ERROR_COPY: Record<RideErrorCode, { title: string; body: string }> = {
  network: { title: "You're offline", body: "Check your connection and try again. Nothing was sent." },
  timeout: { title: "That took too long", body: "The service didn't answer in time. Try again." },
  unauthorized: { title: "Please sign in again", body: "Your session has ended." },
  forbidden: { title: "Not available on your account", body: "This part of Paid Rides isn't open to your role." },
  not_found: { title: "We couldn't find that ride", body: "It may have ended or been removed." },
  conflict: { title: "This ride has moved on", body: "We've refreshed it to show what's happening now." },
  validation: { title: "Something doesn't look right", body: "Check the details and try again." },
  estimate_expired: { title: "Prices have updated", body: "Fares change with demand, so we've fetched fresh ones." },
  no_drivers: { title: "No drivers nearby", body: "No drivers are nearby right now." },
  already_taken: { title: "Another driver got this one", body: "The ride was assigned before your acceptance reached us." },
  request_expired: { title: "This request expired", body: "It was offered to another driver." },
  driver_ineligible: { title: "You can't take this ride", body: "Your vehicle or account doesn't match this ride type." },
  wrong_pin: { title: "That PIN didn't match", body: "Ask the passenger for the 4-digit PIN shown in their app." },
  payment_failed: { title: "Payment didn't go through", body: "Choose another payment method to continue." },
  rate_limited: { title: "Please wait a moment", body: "Too many attempts in a short time." },
  unavailable: { title: "Paid Rides is having trouble", body: "Our service is temporarily unavailable. Try again shortly." },
  not_supported: { title: "Not available yet", body: "This feature isn't switched on yet." },
  unknown: { title: "Something went wrong", body: "Try again. If it keeps happening, contact support." },
};
