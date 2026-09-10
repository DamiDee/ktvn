import type { Metadata } from "next";
import { DriverEarnings } from "@/features/driver/driver-earnings";

export const metadata: Metadata = {
  title: "Earnings",
  description: "A record of your completed professional rides.",
};

export default function DriverEarningsPage() {
  return <DriverEarnings />;
}
