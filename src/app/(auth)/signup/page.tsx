import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "@/features/auth/signup-form";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Join K-Rides and book free buses to service.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow={LIVE_FREE_BUSES ? "Travel together" : "Verified community"}
      trustStatement={LIVE_FREE_BUSES ? "Your community. Your service. A free seat for the journey." : "Membership is confirmed against the community register before your first journey."}
    >
      <SignUpForm />
    </AuthShell>
  );
}
