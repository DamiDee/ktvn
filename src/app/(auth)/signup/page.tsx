import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignUpForm } from "@/features/auth/signup-form";
import { RegistrationChoice } from "@/features/auth/registration-choice";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create your K-Rides account. Your next journey starts here.",
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ role?: string | string[] }> }) {
  const { role } = await searchParams;
  if (role === "driver") redirect("/driver/apply");
  return (
    <AuthShell
      eyebrow="Make room for new journeys"
      trustStatement="Life moves. Move with it."
    >
      {role === "passenger" ? <SignUpForm /> : <RegistrationChoice />}
    </AuthShell>
  );
}
