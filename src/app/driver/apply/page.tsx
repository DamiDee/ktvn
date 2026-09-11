import type { Metadata } from "next";
import { ApplicationWizard } from "@/features/verification/application-wizard";

export const metadata: Metadata = {
  title: "Become a driver",
  description:
    "Apply to drive on K-Rides, as a volunteer or professionally.",
};

export default function DriverApplyPage() {
  return <ApplicationWizard />;
}
