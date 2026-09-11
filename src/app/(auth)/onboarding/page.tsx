import type { Metadata } from "next";
import { OnboardingFlow } from "@/features/auth/onboarding-flow";

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "How K-Rides works, in five short steps.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
