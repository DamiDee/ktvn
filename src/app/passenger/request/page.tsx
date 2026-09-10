import type { Metadata } from "next";
import { RequestRide } from "@/features/passenger/request-ride";

export const metadata: Metadata = {
  title: "Request a ride",
  description: "Choose your track, ride type and destination.",
};

export default function RequestRidePage() {
  return <RequestRide />;
}
