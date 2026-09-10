import type { Metadata } from "next";
import { DriverVehicle } from "@/features/driver/driver-vehicle";

export const metadata: Metadata = {
  title: "Vehicle",
  description: "Your vehicle details and the documents behind them.",
};

export default function DriverVehiclePage() {
  return <DriverVehicle />;
}
