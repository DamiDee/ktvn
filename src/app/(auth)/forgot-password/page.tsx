import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { PasswordResetFlow } from "@/features/auth/password-reset-flow";
import { ForgotPasswordPrepared } from "@/features/auth/account-security";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset the password for your K-Rides account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      trustStatement={LIVE_FREE_BUSES ? "Keep your account private. The transport team can help you find the right support." : "We'll send a code to the contact details on your membership record."}
    >
      {LIVE_FREE_BUSES ? <ForgotPasswordPrepared /> : <PasswordResetFlow />}
    </AuthShell>
  );
}
