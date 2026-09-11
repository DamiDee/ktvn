import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { PasswordResetFlow } from "@/features/auth/password-reset-flow";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset the password for your K-Rides account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      trustStatement="We'll send a code to the contact details on your membership record."
    >
      <PasswordResetFlow />
    </AuthShell>
  );
}
