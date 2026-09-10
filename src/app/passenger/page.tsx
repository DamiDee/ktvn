import type { Metadata } from "next";
import { PassengerDashboard } from "@/features/passenger/dashboard";

export const metadata: Metadata = {
  title: "Home",
  description: "Your journeys, upcoming events and safety status.",
};

export default function PassengerHomePage() {
  return <PassengerDashboard />;
}
