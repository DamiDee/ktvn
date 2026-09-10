import type { Metadata } from "next";
import { OnboardingFlow } from "@/features/auth/onboarding-flow";

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "How the Koinonia Verified Transportation Network works, in five short steps.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
