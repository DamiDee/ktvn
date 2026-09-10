import type { Metadata } from "next";
import { ActiveRideScreen } from "@/features/passenger/active-ride-screen";

export const metadata: Metadata = {
  title: "Your journey",
  description: "Live tracking, trip sharing and safety controls.",
};

export default function ActiveRidePage() {
  return <ActiveRideScreen />;
}
