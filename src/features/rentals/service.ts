import { accountSession, combineSignals } from "@/lib/account-session";
import { getSessionClient } from "@/services/session-client";
import { PAID_RIDES_CONFIG } from "@/features/paid-rides/config";
import { createRentalService } from "./contract";
export const rentalService = createRentalService(async (path, options) => {
  const scope = accountSession.capture();
  const merged = combineSignals([scope.signal, options.signal, AbortSignal.timeout(15_000)]);
  try {
    const response = await getSessionClient(PAID_RIDES_CONFIG.apiBaseUrl).request(path, { ...options, signal: merged.signal });
    const body = await response.text(); scope.assertCurrent();
    return new Response(response.status === 204 ? null : body, { status: response.status });
  } finally { merged.dispose(); }
});
