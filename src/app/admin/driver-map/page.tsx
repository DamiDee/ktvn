import type { Metadata } from "next";
import { LiveDrivers } from "@/features/admin/live-drivers";

export const metadata: Metadata = {
  title: "Driver map",
  description: "Where every online driver is right now.",
};

export default function DriverMapPage() {
  return <LiveDrivers />;
}
