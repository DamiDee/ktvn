import { accountSession } from "../../../lib/account-session.ts";
import { RideServiceError } from "../domain/errors.ts";
import { mapAccountViewer, unwrapAccountResponse } from "../domain/account-profile.ts";

type AccountRequest = (path: string, options: { signal?: AbortSignal }) => Promise<unknown>;

/** Share the paid-rides transport, cookies and account boundary with operational requests. */
export async function loadAccountViewer(request: AccountRequest, userId: string | null, signal?: AbortSignal) {
  if (!userId) throw new RideServiceError("unauthorized");
  const scope = accountSession.capture();
  const user = await request(`/users/${encodeURIComponent(userId)}`, { signal });
  scope.assertCurrent();
  const viewer = mapAccountViewer(user);
  if (viewer.account?.id !== userId) throw new RideServiceError("forbidden");
  const carId = viewer.account.vehicleId;
  if (!carId) return viewer;
  try {
    const car = await request(`/cars/${encodeURIComponent(carId)}`, { signal });
    scope.assertCurrent();
    if (unwrapAccountResponse(car).id !== carId) throw new RideServiceError("unavailable");
    return mapAccountViewer(user, car);
  } catch (error) {
    scope.assertCurrent();
    if (signal?.aborted || error instanceof RideServiceError && error.code === "unauthorized") throw error;
    return mapAccountViewer(user, undefined, true);
  }
}
