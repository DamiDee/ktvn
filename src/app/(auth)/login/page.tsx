import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to K-Rides.",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="A little closer to everywhere"
      trustStatement="Your city. Your rhythm. Your ride."
    >
      <LoginForm />
    </AuthShell>
  );
}
