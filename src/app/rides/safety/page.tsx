import type { Metadata } from "next";
import { SafetyPage } from "@/features/paid-rides/pages/module-pages";

export const metadata: Metadata = { title: "Safety" };

export default function PassengerSafetyPage() {
  return <SafetyPage role="passenger" />;
}
