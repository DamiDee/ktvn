import type { Metadata } from "next";
import { DriverDestination } from "@/features/driver/driver-destination";

export const metadata: Metadata = {
  title: "Set destination",
  description: "Tell the network where you're heading so requests match your route.",
};

export default function DriverDestinationPage() {
  return <DriverDestination />;
}
