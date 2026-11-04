import { toRideError } from "./errors.ts";
export const ESTIMATE_RETRY_DELAY_MS = 5000;
/** One automatic retry for transient failures, then explicit rider action. */
export function retryEstimate(failureCount: number, error: Error): boolean {
  return failureCount < 1 && toRideError(error).retryable;
}
