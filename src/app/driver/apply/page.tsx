import type { Metadata } from "next";
import { ApplicationWizard } from "@/features/verification/application-wizard";

export const metadata: Metadata = {
  title: "Become a driver",
  description:
    "Start your driver application with K-Rides.",
};

export default function DriverApplyPage() {
  return <ApplicationWizard />;
}
