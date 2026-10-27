import type { ScheduleListQuery, ScheduledRide, ScheduledRidePage } from "./contract.ts";

export type PassengerScheduleView = "upcoming" | "history";

export function scheduleBelongsToView(booking: ScheduledRide, view: PassengerScheduleView) {
  const finished = ["COMPLETED", "CANCELLED", "EXPIRED"].includes(booking.status);
  return view === "history" ? finished : !finished;
}

/** The API supports one status at a time, so filter pages without inventing a
 * multi-status parameter or showing an empty list while later pages match. */
export async function passengerSchedulePage(
  read: (query: ScheduleListQuery, signal?: AbortSignal) => Promise<ScheduledRidePage>,
  view: PassengerScheduleView,
  query: ScheduleListQuery,
  signal?: AbortSignal,
): Promise<ScheduledRidePage> {
  let cursor = query.cursor;
  const visited = new Set<string>();
  for (;;) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const key = cursor ?? "first";
    if (visited.has(key)) throw new Error("The booking list could not advance. Please refresh your trips.");
    visited.add(key);
    const page = await read({ ...query, ...(cursor ? { cursor } : {}) }, signal);
    const items = page.items.filter((booking) => scheduleBelongsToView(booking, view));
    if (items.length || !page.nextCursor) return { ...page, items };
    cursor = page.nextCursor;
  }
}
