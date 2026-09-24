import type { Metadata } from "next";
import { PassengerProfile } from "@/features/passenger/passenger-profile";
import { LiveMemberProfile } from "@/features/passenger/live-member-profile";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your K-Rides account and personal details.",
};

export default function PassengerProfilePage() {
  return LIVE_FREE_BUSES ? <LiveMemberProfile /> : <PassengerProfile />;
}
