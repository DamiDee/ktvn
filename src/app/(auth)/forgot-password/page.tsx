import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { PasswordResetFlow } from "@/features/auth/password-reset-flow";
import { LivePasswordReset } from "@/features/auth/live-password-reset";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset the password for your K-Rides account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      trustStatement={LIVE_FREE_BUSES ? "Reset your password securely with a code sent to your account email." : "We'll send a code to the contact details on your membership record."}
    >
      {LIVE_FREE_BUSES ? <LivePasswordReset /> : <PasswordResetFlow />}
    </AuthShell>
  );
}
