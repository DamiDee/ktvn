import { z } from "zod";
export const resetEmail = z.string().trim().email();
export const resetInput = z.object({ email: resetEmail, otp: z.string().regex(/^[0-9]{6}$/, "Enter the six-digit code."), newPassword: z.string().min(8).max(128) }).strict();
export function createResetApi(send: typeof fetch, base: string) {
  async function post(path: string, body: object) {
    let response: Response;
    try { response = await send(`${base.replace(/\/$/, "")}/auth/${path}`, { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) }); }
    catch { throw new Error("The result could not be confirmed. If you submitted a new password, try signing in with it or request another code."); }
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = undefined; }
    if (!response.ok) throw new Error(response.status < 500 && typeof data?.message === "string" ? data.message : "The request could not be completed. Please try again.");
    if (typeof data?.message !== "string") throw new Error("The response could not be confirmed. Try signing in or request another code.");
  }
  return { request: (email: string) => post("forgot-password", { email: resetEmail.parse(email) }), reset: (body: z.infer<typeof resetInput>) => post("reset-password", resetInput.parse(body)) };
}
