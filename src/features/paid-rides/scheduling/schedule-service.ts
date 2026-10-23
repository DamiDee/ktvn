import { acceptanceSchema, bookingSchema, createSchema, pageSchema, reasonSchema, scheduleListSearch, timeChangeSchema, uuid, type CreateScheduledRide, type ScheduledRide, type ScheduleListQuery } from "./contract.ts";

export class ScheduleApiError extends Error {
  readonly status: number | null;
  readonly code?: string;
  constructor(message: string, status: number | null, code?: string) { super(message); this.name = "ScheduleApiError"; this.status = status; this.code = code; }
  get uncertain() { return this.status === null || this.status >= 500; }
}
export type ScheduleRequest = (path: string, options: RequestInit) => Promise<Response>;
/** Exact, direct-object API contract. No automatic mutation retries. */
export function createScheduleService(send: ScheduleRequest) {
  async function request(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await send(path, { method, signal, headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch (error) {
      if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ScheduleApiError("The response could not be confirmed. Refresh before making another change.", null);
    }
    let text: string;
    try { text = await response.text(); } catch { throw new ScheduleApiError("The response could not be confirmed. Refresh before making another change.", null); }
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = undefined; }
    if (!response.ok) {
      const error = data && typeof data === "object" ? data as { message?: unknown; code?: unknown } : {};
      const fallback = response.status === 409 ? "This request changed, was accepted, or conflicts with another journey. Refresh and review it again." : response.status === 401 ? "Sign in again to continue." : response.status === 404 ? "This booking is missing or no longer accessible." : "The booking could not be confirmed. Please refresh.";
      const message = response.status < 500 && typeof error.message === "string" ? error.message.slice(0, 300) : fallback;
      throw new ScheduleApiError(message, response.status, typeof error.code === "string" ? error.code : undefined);
    }
    return data;
  }
  async function booking(path: string, method?: string, body?: unknown, signal?: AbortSignal): Promise<ScheduledRide> {
    const data = await request(path, method, body, signal);
    const parsed = bookingSchema.safeParse(data);
    if (!parsed.success) throw new ScheduleApiError("The booking response could not be confirmed. Refresh before trying again.", null);
    return parsed.data;
  }
  return {
    create: async (input: CreateScheduledRide, signal?: AbortSignal) => booking("rides/scheduled", "POST", createSchema.parse(input), signal),
    async listBookings(query: ScheduleListQuery = {}, signal?: AbortSignal) { return pageSchema.parse(await request(`rides/scheduled${scheduleListSearch(query, false)}`, "GET", undefined, signal)); },
    async listDriver(query: ScheduleListQuery = {}, signal?: AbortSignal) { return pageSchema.parse(await request(`driver/scheduled-requests${scheduleListSearch(query, true)}`, "GET", undefined, signal)); },
    get: async (id: string, signal?: AbortSignal) => booking(`rides/scheduled/${uuid.parse(id)}`, "GET", undefined, signal),
    reschedule: async (id: string, input: { scheduledAt: string; timezone: string }, signal?: AbortSignal) => booking(`rides/scheduled/${uuid.parse(id)}`, "PATCH", timeChangeSchema.parse(input), signal),
    cancelPassenger: async (id: string, reason: string, signal?: AbortSignal) => booking(`rides/scheduled/${uuid.parse(id)}/cancel`, "POST", reasonSchema.parse({ reason }), signal),
    accept: async (id: string, version: number, signal?: AbortSignal) => booking(`driver/scheduled-requests/${uuid.parse(id)}/accept`, "POST", acceptanceSchema.parse({ version }), signal),
    release: async (id: string, reason: string, signal?: AbortSignal) => booking(`driver/scheduled-requests/${uuid.parse(id)}/cancel`, "POST", reasonSchema.parse({ reason }), signal),
  };
}
export type ScheduleService = ReturnType<typeof createScheduleService>;
