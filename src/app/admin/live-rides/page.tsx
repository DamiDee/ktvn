import type { Metadata } from "next";
import { LiveRides } from "@/features/admin/live-rides";

export const metadata: Metadata = {
  title: "Live rides",
  description: "Every journey currently in progress across the network.",
};

export default function LiveRidesPage() {
  return <LiveRides />;
}
