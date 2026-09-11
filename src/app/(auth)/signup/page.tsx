import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "@/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Join K-Rides as a verified member.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Verified community"
      trustStatement="Membership is confirmed against the community register before your first journey."
    >
      <SignUpForm />
    </AuthShell>
  );
}
