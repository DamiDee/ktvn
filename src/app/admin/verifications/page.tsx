import type { Metadata } from "next";
import { VerificationQueue } from "@/features/admin/verification-queue";

export const metadata: Metadata = {
  title: "Verification queue",
  description: "Driver applications waiting on a decision.",
};

export default function VerificationQueuePage() {
  return <VerificationQueue />;
}
