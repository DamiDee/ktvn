import { z } from "zod";
const instant = z.string().datetime({ offset: true });
export const rentalSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid(), startsAt: instant, endsAt: instant, pickupLocation: z.string(), notes: z.string(), status: z.enum(["pending", "assigned"]), assignedBy: z.string().uuid().nullable(), assignedAt: instant.nullable(), createdAt: instant, updatedAt: instant });
export type Rental = z.infer<typeof rentalSchema>;
export const rentalInputSchema = z.object({ startsAt: instant, endsAt: instant, pickupLocation: z.string().max(1000).refine(v => !!v.trim(), "Enter a pickup location."), notes: z.string().max(5000).optional() }).strict();
export type RentalInput = z.infer<typeof rentalInputSchema>;
export function validateRental(input: RentalInput, now = Date.now()) {
  const value = rentalInputSchema.parse(input);
  if (Date.parse(value.startsAt) <= now) throw new Error("Choose a start time in the future.");
  if (Date.parse(value.endsAt) - Date.parse(value.startsAt) < 86_400_000) throw new Error("Choose at least 24 consecutive hours.");
  return { ...value, pickupLocation: value.pickupLocation.trim() };
}
export class RentalError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
  get uncertain() { return this.status === 0 || this.status >= 500; }
}
export function createRentalService(send: (path: string, options: RequestInit) => Promise<Response>) {
  async function request(path: string, method = "GET", body?: RentalInput, signal?: AbortSignal) {
    let response: Response, text: string;
    try { response = await send(path, { method, signal, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }); text = await response.text(); }
    catch (e) { if (signal?.aborted) throw e; throw new RentalError("The result could not be confirmed. Refresh your requests before trying again.", 0); }
    let data; try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
    if (!response.ok) throw new RentalError(response.status < 500 && typeof data?.message === "string" ? data.message : `Request could not be completed (${response.status}). Refresh and try again.`, response.status);
    return data;
  }
  async function record(path: string, method?: string, body?: RentalInput) {
    const result = rentalSchema.safeParse(await request(path, method, body));
    if (!result.success) throw new RentalError("The saved request could not be confirmed. Refresh before retrying.", 0);
    return result.data;
  }
  const idPath = (id: string) => z.string().uuid().parse(id);
  return {
    list: async (admin: boolean, status: string, offset: number, signal?: AbortSignal) => z.array(rentalSchema).parse(await request(`${admin ? "admin/" : ""}rentals?limit=20&offset=${z.number().int().nonnegative().parse(offset)}${status ? `&status=${z.enum(["pending", "assigned"]).parse(status)}` : ""}`, "GET", undefined, signal)),
    create: (input: RentalInput) => record("rentals", "POST", validateRental(input)),
    update: (id: string, input: RentalInput) => record(`rentals/${idPath(id)}`, "PUT", validateRental(input)),
    remove: (id: string) => request(`rentals/${idPath(id)}`, "DELETE"),
    assign: (id: string) => record(`admin/rentals/${idPath(id)}/assign`, "POST"),
  };
}
