import type { Metadata } from "next";
import { DriverProfile } from "@/features/driver/driver-profile";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your driver profile, verification and settings.",
};

export default function DriverProfilePage() {
  return <DriverProfile />;
}
