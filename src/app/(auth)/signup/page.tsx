import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "@/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create your K-Rides account. Your next journey starts here.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Make room for new journeys"
      trustStatement="Life moves. Move with it."
    >
      <SignUpForm />
    </AuthShell>
  );
}
