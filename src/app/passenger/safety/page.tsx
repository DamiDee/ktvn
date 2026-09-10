import type { Metadata } from "next";
import { SafetyCentre } from "@/features/passenger/safety-centre";

export const metadata: Metadata = {
  title: "Safety",
  description: "Trusted contacts, trip sharing and SOS.",
};

export default function PassengerSafetyPage() {
  return <SafetyCentre />;
}
