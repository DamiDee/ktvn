import { accountSession, combineSignals } from "@/lib/account-session";
import { getSessionClient } from "@/services/session-client";
import { PAID_RIDES_CONFIG } from "../config";
import { createScheduleService } from "./schedule-service";

/** Shares the existing cookie refresh and account fence, never stores access tokens. */
export const apiScheduleService = createScheduleService(async (path, options) => {
  const scope = accountSession.capture();
  const merged = combineSignals([scope.signal, options.signal, AbortSignal.timeout(15_000)]);
  try {
    const response = await getSessionClient(PAID_RIDES_CONFIG.apiBaseUrl).request(path, { ...options, signal: merged.signal });
    // Buffer under the account fence: a response completing after logout is unusable.
    const text = await response.text();
    scope.assertCurrent();
    return new Response([204, 205, 304].includes(response.status) ? null : text, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { merged.dispose(); }
});
