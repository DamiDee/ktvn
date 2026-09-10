import type { Metadata } from "next";
import { PassengerProfile } from "@/features/passenger/passenger-profile";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your membership, safety settings and journeys.",
};

export default function PassengerProfilePage() {
  return <PassengerProfile />;
}
