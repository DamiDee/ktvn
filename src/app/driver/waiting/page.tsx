import type { Metadata } from "next";
import { DriverWaiting } from "@/features/driver/driver-waiting";

export const metadata: Metadata = {
  title: "Waiting for members",
  description: "Your route, your free seats and the requests coming in.",
};

export default function DriverWaitingPage() {
  return <DriverWaiting />;
}
