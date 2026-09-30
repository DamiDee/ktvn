"use client";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

/** Ready for a verified password endpoint; never routes a real account into the demo reset. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  return <><Button variant="secondary" onClick={() => setOpen(true)}>Change password</Button><Modal open={open} onClose={() => setOpen(false)} title="Change your password" description="Prepared · waiting for the account-security service">
    <p className="mb-5 text-sm leading-relaxed text-ink-secondary">Password changes aren’t available yet. Your current password is unchanged. This form will be enabled when the backend provides a secure change-password endpoint.</p>
    <fieldset disabled className="space-y-4"><PasswordInput label="Current password" autoComplete="current-password" /><PasswordInput label="New password" autoComplete="new-password" /><PasswordInput label="Confirm new password" autoComplete="new-password" /><Button disabled block>Save new password — not available yet</Button></fieldset>
    <p className="mt-4 text-xs text-ink-secondary">No password is collected, saved or sent from this preview.</p>
  </Modal></>;
}

export function ForgotPasswordPrepared() {
  return <div><p className="text-xs font-medium tracking-wide text-gold-800 dark:text-gold-300">ACCOUNT RECOVERY · COMING SOON</p><h1 className="type-page-title mt-3 text-ink">Forgot your password?</h1><p className="mt-3 text-sm leading-relaxed text-ink-secondary">The recovery page is ready, but password-reset emails are not available yet. No reset code or link will be sent from this screen.</p><fieldset disabled className="mt-7 space-y-4"><Input label="Account email" type="email" autoComplete="email" placeholder="you@example.com" /><Button block disabled>Send reset link — not available yet</Button></fieldset><p className="mt-5 text-sm leading-relaxed text-ink-secondary">Ask the church transport team for account-access assistance. Never share your password or a verification code.</p><ButtonLink className="mt-6" href="/login" variant="secondary">Back to sign in</ButtonLink></div>;
}
