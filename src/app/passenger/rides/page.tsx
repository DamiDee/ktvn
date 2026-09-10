import type { Metadata } from "next";
import { RidesList } from "@/features/passenger/rides-list";

export const metadata: Metadata = {
  title: "Your rides",
  description: "Every journey you've taken across both tracks.",
};

export default function PassengerRidesPage() {
  return <RidesList />;
}
