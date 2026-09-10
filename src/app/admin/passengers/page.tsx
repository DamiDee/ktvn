import type { Metadata } from "next";
import { PassengersList } from "@/features/admin/passengers-list";

export const metadata: Metadata = {
  title: "Passengers",
  description: "Members who can request a ride on the network.",
};

export default function AdminPassengersPage() {
  return <PassengersList />;
}
