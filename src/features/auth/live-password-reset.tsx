"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { changeAccountSession } from "@/lib/account-session";
import { createResetApi } from "./reset-api";
const api = createResetApi((...args) => fetch(...args), process.env.NEXT_PUBLIC_FREEBUS_API_BASE_URL ?? "https://api.freebus.cloud/api/v1");
export function LivePasswordReset() {
  const [email, setEmail] = useState(""), [otp, setOtp] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "done">("email"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [seconds, setSeconds] = useState(0);
  const lock = useRef(false), deadline = useRef(0), queries = useQueryClient();
  useEffect(() => { const timer = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000); return () => clearInterval(timer); }, []);
  async function submit(reset: boolean) {
    if (lock.current || (!reset && Date.now() < deadline.current)) return; lock.current = true; setBusy(true); setError("");
    try {
      if (reset) {
        if (password !== confirm) throw new Error("The passwords do not match.");
        await api.reset({ email, otp, newPassword: password });
        changeAccountSession(true); queries.clear();
        try { localStorage.removeItem("kr-freebus-user"); } catch {}
        setOtp(""); setPassword(""); setConfirm(""); setStage("done");
      } else { await api.request(email); deadline.current = Date.now() + 60_000; setSeconds(60); setOtp(""); setStage("code"); }
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div><h1 className="type-page-title">{stage === "done" ? "Password reset" : "Reset your password"}</h1>
    {stage === "done" ? <><p className="mt-4">Your password was updated. Sign in with your new password.</p><ButtonLink className="mt-6" href="/login">Back to sign in</ButtonLink></> : <form className="mt-6 space-y-4" onSubmit={e => { e.preventDefault(); void submit(stage === "code"); }}>
      <Input label="Account email" type="email" required autoComplete="email" value={email} disabled={busy || stage === "code"} onChange={e => setEmail(e.target.value)} />
      {stage === "code" ? <><p className="text-sm text-ink-secondary">If your account is active, we’ll email a code. Use the latest code; resending won’t extend its expiry.</p><Input label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={otp} disabled={busy} onChange={e => setOtp(e.target.value)} /><PasswordInput label="New password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /><PasswordInput label="Confirm new password" autoComplete="new-password" required value={confirm} disabled={busy} onChange={e => setConfirm(e.target.value)} /></> : null}
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
      <Button type="submit" block loading={busy} disabled={stage === "email" && seconds > 0}>{stage === "email" ? seconds > 0 ? `Send code in ${seconds}s` : "Send reset code" : "Reset password"}</Button>
      {stage === "code" ? <div className="flex flex-wrap gap-2"><Button variant="ghost" disabled={busy || seconds > 0} onClick={() => void submit(false)}>{seconds ? `Resend in ${seconds}s` : "Resend code"}</Button><Button variant="ghost" disabled={busy} onClick={() => { setStage("email"); setOtp(""); setPassword(""); setConfirm(""); setError(""); }}>Change email</Button></div> : null}
      <ButtonLink href="/login" variant="ghost">Back to sign in</ButtonLink>
    </form>}
  </div>;
}
