import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Koinonia Verified Transportation Network.",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      trustStatement="Your journeys, your drivers and your trip history are waiting where you left them."
    >
      <LoginForm />
    </AuthShell>
  );
}
