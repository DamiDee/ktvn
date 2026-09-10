import type { Metadata } from "next";
import { VerificationProgress } from "@/features/verification/verification-progress";

export const metadata: Metadata = {
  title: "Verification",
  description: "Track the progress of your driver application.",
};

export default function DriverVerificationPage() {
  return <VerificationProgress />;
}
