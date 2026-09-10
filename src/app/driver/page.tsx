import type { Metadata } from "next";
import { DriverHome } from "@/features/driver/driver-home";

export const metadata: Metadata = {
  title: "Driver home",
  description: "Your availability, requests and journey record.",
};

export default function DriverHomePage() {
  return <DriverHome />;
}
